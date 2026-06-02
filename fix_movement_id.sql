-- Cambiar movement_id de UUID a TEXT para aceptar cualquier tipo de ID
-- Ejecutar en Supabase Dashboard > SQL Editor

ALTER TABLE public.approval_requests 
ALTER COLUMN movement_id DROP DEFAULT,
ALTER COLUMN movement_id TYPE TEXT USING movement_id::TEXT,
ALTER COLUMN movement_id SET DEFAULT NULL;

-- Agregar comentario
COMMENT ON COLUMN public.approval_requests.movement_id IS 'ID del movimiento (puede ser UUID temporal o real)'; 
