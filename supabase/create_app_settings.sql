-- =========================================================================
-- SCRIPT DE CONFIGURACIÓN GLOBAL DE AJUSTES
-- Ejecuta este script en el SQL Editor de Supabase
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer la configuración
CREATE POLICY "auth_select_app_settings" ON public.app_settings FOR SELECT TO authenticated USING (true);

-- Solo los administradores pueden modificar la configuración
CREATE POLICY "admin_all_app_settings" ON public.app_settings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Insertar valor por defecto
INSERT INTO public.app_settings (key, value) VALUES ('daily_report_time', '23:00') ON CONFLICT DO NOTHING;

-- Habilitar tiempo real si es necesario
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
