-- ============================================================
-- DICREJART - Sistema de Aprobación por Supervisor
-- Migración para salidas de inventario sin factura
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── EXTENDER TABLA MOVEMENTS ───
ALTER TABLE public.movements 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approval_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approval_notes TEXT,
ADD COLUMN IF NOT EXISTS notification_method TEXT DEFAULT 'email',
ADD COLUMN IF NOT EXISTS item_id UUID;

-- ─── CREAR TABLA APPROVAL_REQUESTS ───
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  movement_id UUID REFERENCES public.movements(id),
  requester_id UUID REFERENCES public.profiles(id),
  supervisor_id UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, expired
  requested_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notification_method TEXT DEFAULT 'email',
  notification_status TEXT DEFAULT 'pending', -- pending, sent, failed
  metadata JSONB DEFAULT '{}'
);

-- ─── ÍNDICES PARA PERFORMANCE ───
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_supervisor ON public.approval_requests(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON public.approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_movement ON public.approval_requests(movement_id);
CREATE INDEX IF NOT EXISTS idx_movements_approval_status ON public.movements(approval_status);
CREATE INDEX IF NOT EXISTS idx_movements_supervisor ON public.movements(supervisor_id);

-- ─── RLS (ROW LEVEL SECURITY) PARA APPROVAL_REQUESTS ───
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Solo el solicitante y el supervisor asignado pueden leer la solicitud (autenticados)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='approval_requests' AND policyname='strict_select_approval_requests') THEN
    CREATE POLICY "strict_select_approval_requests" ON public.approval_requests FOR SELECT TO authenticated
    USING (auth.uid() = requester_id OR auth.uid() = supervisor_id);
  END IF;
END $$;

-- Policy: Solo usuarios autenticados pueden insertar solicitudes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='approval_requests' AND policyname='auth_insert_approval_requests') THEN
    CREATE POLICY "auth_insert_approval_requests" ON public.approval_requests FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- Policy: Solo el supervisor asignado puede hacer actualizaciones directas (autenticados)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='approval_requests' AND policyname='strict_update_approval_requests') THEN
    CREATE POLICY "strict_update_approval_requests" ON public.approval_requests FOR UPDATE TO authenticated
    USING (auth.uid() = supervisor_id);
  END IF;
END $$;

-- ─── CREAR TABLA DE AUDITORÍA ───
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  entity_type TEXT NOT NULL, -- 'movement', 'approval_request'
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'created', 'approved', 'rejected', 'expired', 'updated'
  user_id UUID REFERENCES public.profiles(id),
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT
);

-- ─── ÍNDICES PARA AUDITORÍA ───
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- ─── RLS PARA AUDITORÍA ───
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_log' AND policyname='auth_select_audit_log') THEN
    CREATE POLICY "auth_select_audit_log" ON public.audit_log FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'supervisor')
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_log' AND policyname='auth_insert_audit_log') THEN
    CREATE POLICY "auth_insert_audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- ─── TRIGGER PARA AUDITORÍA AUTOMÁTICA EN APPROVAL_REQUESTS ───
CREATE OR REPLACE FUNCTION log_approval_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, user_id, old_values, new_values, details)
    VALUES (
      'approval_request', 
      NEW.id, 
      'updated', 
      auth.uid(), 
      row_to_json(OLD), 
      row_to_json(NEW),
      'Status changed from ' || COALESCE(OLD.status, 'null') || ' to ' || COALESCE(NEW.status, 'null')
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, user_id, new_values, details)
    VALUES (
      'approval_request', 
      NEW.id, 
      'created', 
      NEW.requester_id, 
      row_to_json(NEW),
      'Approval request created for movement ' || COALESCE(NEW.movement_id::text, 'null')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS approval_audit_trigger ON public.approval_requests;
CREATE TRIGGER approval_audit_trigger
AFTER INSERT OR UPDATE ON public.approval_requests
FOR EACH ROW EXECUTE FUNCTION log_approval_changes();

-- ─── FUNCIÓN PARA LIMPIEZA AUTOMÁTICA DE SOLICITUDES EXPIRADAS ───
CREATE OR REPLACE FUNCTION cleanup_expired_requests()
RETURNS void AS $$
BEGIN
  UPDATE public.approval_requests
  SET status = 'expired',
      completed_at = now(),
      notification_status = 'expired'
  WHERE status = 'pending'
    AND timeout_at < now();
END;
$$ LANGUAGE plpgsql;

-- ─── COMENTARIOS DE DOCUMENTACIÓN ───
COMMENT ON TABLE public.approval_requests IS 'Solicitudes de aprobación para salidas de inventario sin factura';
COMMENT ON COLUMN public.approval_requests.status IS 'Estados: pending, approved, rejected, expired';
COMMENT ON COLUMN public.movements.approval_status IS 'Estados: pending, approved, rejected, expired, completed';
COMMENT ON TABLE public.audit_log IS 'Bitácora de auditoría para cambios en el sistema de aprobaciones';

-- ─── FUNCIÓN DE AYUDA PARA OBTENER SUPERVISORES DISPONIBLES ───
CREATE OR REPLACE FUNCTION get_available_supervisors()
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  role TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.email,
    p.role
  FROM public.profiles p
  WHERE p.role IN ('admin', 'supervisor')
  ORDER BY p.role DESC, p.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── SEGURIDAD CON TOKENS CRIPTOGRÁFICOS ───

-- Agregar columna de token criptográfico automático
ALTER TABLE public.approval_requests 
ADD COLUMN IF NOT EXISTS security_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex');

-- RPC para consulta segura mediante token (lectura pública limitada)
CREATE OR REPLACE FUNCTION public.get_approval_request_by_token(p_id UUID, p_token TEXT)
RETURNS TABLE (
  id UUID,
  status TEXT,
  timeout_at TIMESTAMPTZ,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT ar.id, ar.status, ar.timeout_at, ar.metadata
  FROM public.approval_requests ar
  WHERE ar.id = p_id AND ar.security_token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para responder a la solicitud segura mediante token (aprobación/rechazo público limitado)
CREATE OR REPLACE FUNCTION public.respond_to_approval_request_by_token(
  p_id UUID,
  p_token TEXT,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
  v_timeout TIMESTAMPTZ;
BEGIN
  -- Validar existencia e integridad del token
  SELECT status, timeout_at INTO v_current_status, v_timeout
  FROM public.approval_requests
  WHERE id = p_id AND security_token = p_token;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token de seguridad inválido o solicitud no encontrada.';
  END IF;
  
  IF v_current_status <> 'pending' THEN
    RAISE EXCEPTION 'Esta solicitud ya ha sido procesada.';
  END IF;
  
  IF v_timeout < now() THEN
    UPDATE public.approval_requests SET status = 'expired', completed_at = now() WHERE id = p_id;
    RETURN FALSE;
  END IF;
  
  -- Ejecutar la actualización de forma segura (salta RLS por SECURITY DEFINER)
  UPDATE public.approval_requests
  SET 
    status = p_status,
    completed_at = now(),
    rejection_reason = COALESCE(p_rejection_reason, rejection_reason)
  WHERE id = p_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para actualización de permisos de usuario (administrador de equipo)
CREATE OR REPLACE FUNCTION public.update_user_permissions(
  target_user_id UUID,
  new_allowed_views TEXT[],
  new_allowed_categories TEXT[],
  new_editable_categories TEXT[]
)
RETURNS void AS $$
DECLARE
  calling_user_role TEXT;
BEGIN
  SELECT role INTO calling_user_role FROM public.profiles WHERE id = auth.uid();
  IF calling_user_role <> 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden modificar los permisos.';
  END IF;
  
  UPDATE public.profiles
  SET 
    allowed_views = new_allowed_views,
    allowed_categories = new_allowed_categories,
    editable_categories = new_editable_categories,
    updated_at = now()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función y trigger para autocreación de perfiles tras signUp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, allowed_categories, editable_categories, allowed_views)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', new.email),
    'user',
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    ARRAY['dashboard', 'profile']::TEXT[]
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();