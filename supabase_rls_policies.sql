-- ==========================================
-- ARCHIVO DE POLÍTICAS RLS (Row Level Security) PARA SUPABASE
-- ==========================================
-- Instrucciones de uso:
-- Ejecuta este script en el editor SQL del panel de Supabase para
-- proteger las tablas principales de la aplicación contra accesos no autorizados.

-- --------------------------------------------------------
-- 1. HABILITAR ROW LEVEL SECURITY EN LAS TABLAS
-- --------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;


-- --------------------------------------------------------
-- 2. POLÍTICAS PARA LA TABLA: profiles
-- --------------------------------------------------------

-- Permitir a los usuarios autenticados leer todos los perfiles 
-- (Necesario para poder listar a los usuarios en la app)
CREATE POLICY "Permitir SELECT en profiles a usuarios autenticados"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Permitir la inserción de nuevos perfiles (ej. al registrarse a través de un trigger de auth.users o manualmente)
CREATE POLICY "Permitir INSERT en profiles a usuarios autenticados"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Un usuario solo debe poder actualizar su PROPIO perfil (y no los de otros)
CREATE POLICY "Permitir UPDATE propio en profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- NOTA: Por defecto, los DELETE están bloqueados a menos que se cree una política explícita.


-- --------------------------------------------------------
-- 3. POLÍTICAS PARA LA TABLA: movements
-- --------------------------------------------------------

-- Permitir leer movimientos a todos los usuarios autenticados
CREATE POLICY "Permitir SELECT en movements a usuarios autenticados"
ON public.movements
FOR SELECT
TO authenticated
USING (true);

-- Permitir registrar nuevos movimientos a usuarios autenticados
CREATE POLICY "Permitir INSERT en movements a usuarios autenticados"
ON public.movements
FOR INSERT
TO authenticated
WITH CHECK (true);

-- IMPORTANTE: No se permiten UPDATE ni DELETE en la tabla de movimientos.
-- Esto asegura que el historial financiero/de inventario sea inmutable.
-- Si un usuario intenta hacer un update o delete a través de la API cliente, será bloqueado.
-- Si el sistema requiere anular un movimiento, se debe agregar una política muy restrictiva
-- (ej. solo para administradores/supervisores). Por ahora, el bloqueo es total:

CREATE POLICY "Bloquear UPDATE en movements"
ON public.movements
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Bloquear DELETE en movements"
ON public.movements
FOR DELETE
TO authenticated
USING (false);


-- --------------------------------------------------------
-- 4. POLÍTICAS PARA LA TABLA: approval_requests
-- --------------------------------------------------------

-- Permitir que cualquier usuario autenticado vea las solicitudes
CREATE POLICY "Permitir SELECT en approval_requests"
ON public.approval_requests
FOR SELECT
TO authenticated
USING (true);

-- Permitir que cualquier usuario autenticado cree una solicitud
CREATE POLICY "Permitir INSERT en approval_requests"
ON public.approval_requests
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir actualizar solicitudes (ej. para aprobarlas o rechazarlas).
-- NOTA/TODO: Actualmente cualquier usuario autenticado puede actualizar. 
-- Para restringirlo estrictamente a supervisores, se debería reemplazar el `USING (true)` por 
-- una subconsulta a la tabla profiles como la siguiente:
-- USING (
--   EXISTS (
--     SELECT 1 FROM profiles 
--     WHERE profiles.id = auth.uid() AND profiles.role = 'supervisor'
--   )
-- )
CREATE POLICY "Permitir UPDATE en approval_requests"
ON public.approval_requests
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
 
