-- =========================================================================
-- SCRIPT DE CONFIGURACIÓN DE REPORTE DIARIO (CRON DINÁMICO)
-- Ejecuta este script en el SQL Editor de Supabase
-- =========================================================================

-- 1. Habilitar extensiones requeridas para tareas programadas y peticiones web
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Crear función RPC que React llamará para actualizar el horario
CREATE OR REPLACE FUNCTION public.update_report_schedule(cron_expression TEXT, webhook_url TEXT, cron_secret TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 2.1 Validar que el usuario que ejecuta esto tenga rol 'admin'
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden configurar el reporte diario.';
  END IF;

  -- 2.2 Desprogramar el trabajo anterior si es que existe (ignorará si no existe)
  BEGIN
    PERFORM cron.unschedule('daily_report_job');
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar si no existe
  END;

  -- 2.3 Programar el nuevo trabajo con el nuevo horario
  -- El comando usa pg_net para enviar una petición POST a tu servidor en Vercel
  PERFORM cron.schedule(
    'daily_report_job',
    cron_expression,
    format(
      $$SELECT net.http_post(url:='%s', headers:=jsonb_build_object('Authorization', 'Bearer %s', 'Content-Type', 'application/json'))$$,
      webhook_url,
      cron_secret
    )
  );

END;
$$;

-- 3. Otorgar permisos a la aplicación para ejecutar esta función
GRANT EXECUTE ON FUNCTION public.update_report_schedule(TEXT, TEXT, TEXT) TO authenticated;
