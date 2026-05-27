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

-- Policy: Permitir lectura pública de solicitudes (requerido para enlaces de email sin login)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='approval_requests' AND policyname='auth_select_approval_requests') THEN
    CREATE POLICY "auth_select_approval_requests" ON public.approval_requests FOR SELECT TO public USING (true);
  END IF;
END $$;

-- Policy: Solo usuarios autenticados pueden insertar solicitudes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='approval_requests' AND policyname='auth_insert_approval_requests') THEN
    CREATE POLICY "auth_insert_approval_requests" ON public.approval_requests FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- Policy: Permitir actualización pública de solicitudes pendientes (requerido para aprobar/rechazar desde email sin login)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='approval_requests' AND policyname='auth_update_approval_requests') THEN
    CREATE POLICY "auth_update_approval_requests" ON public.approval_requests FOR UPDATE TO public 
    USING (status = 'pending')
    WITH CHECK (status IN ('approved', 'rejected'));
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