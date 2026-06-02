-- Script para debugear el problema de supervisores
-- Ejecutar en Supabase Dashboard > SQL Editor

-- 1. Verificar si la tabla profiles existe y tiene datos
SELECT COUNT(*) as total_profiles FROM profiles;

-- 2. Ver todos los usuarios y sus roles
SELECT id, name, email, role FROM profiles ORDER BY role DESC, name ASC;

-- 3. Verificar usuarios con rol admin o supervisor
SELECT id, name, email, role 
FROM profiles 
WHERE role IN ('admin', 'supervisor') 
ORDER BY role DESC, name ASC;

-- 4. Si no hay supervisores, actualizar algunos usuarios (descomentar las líneas necesarias)
-- UPDATE profiles SET role = 'admin' WHERE email = 'tu_email_admin@ejemplo.com';
-- UPDATE profiles SET role = 'supervisor' WHERE email = 'tu_email_supervisor@ejemplo.com';

-- 5. Verificar si hay usuarios sin rol asignado
SELECT id, name, email, role 
FROM profiles 
WHERE role IS NULL OR role = 'user' OR role = '';

-- 6. Para crear un supervisor de prueba (descomentar si es necesario)
-- UPDATE profiles 
-- SET role = 'supervisor' 
-- WHERE email = (SELECT email FROM profiles LIMIT 1);

-- 7. Verificar la estructura de la tabla profiles
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position; 
