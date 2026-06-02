# 🔧 Solución Rápida: No cargan supervisores

## Problema
El selector de supervisores no muestra la lista de usuarios disponibles.

## Soluciones (en orden)

### 1️⃣ VERIFICAR ROLES DE USUARIOS (Más probable)

Ejecuta este script en **Supabase Dashboard > SQL Editor**:

```sql
-- Ver usuarios con roles admin/supervisor
SELECT id, name, email, role 
FROM profiles 
WHERE role IN ('admin', 'supervisor') 
ORDER BY role DESC, name ASC;
```

**Si no devuelve resultados:** Tienes que asignar roles a los usuarios:

```sql
-- Asignar rol de admin a tu usuario principal
UPDATE profiles SET role = 'admin' WHERE email = 'tu_email@ejemplo.com';

-- Asignar rol de supervisor a otro usuario
UPDATE profiles SET role = 'supervisor' WHERE email = 'otro_email@ejemplo.com';
```

### 2️⃣ EJECUTAR SCRIPT DE DEBUG

Usa el archivo `debug_supervisors.sql` que creé:

1. Abre `debug_supervisors.sql`
2. Copia el contenido
3. Pégalo en **Supabase Dashboard > SQL Editor**
4. Ejecuta y revisa los resultados

### 3️⃣ VERIFICAR QUE LA TABLA PROFILES TENGA LA COLUMNA ROLE

```sql
-- Ver estructura de la tabla
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'role';
```

**Si no existe la columna role:**

```sql
ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';
```

### 4️⃣ RECARGAR LA APLICACIÓN

Después de hacer cambios en la base de datos:

1. Recarga la página (F5)
2. Abre el ActionModal
3. Intenta seleccionar "Solicitar Aprobación"
4. Debería aparecer la lista de supervisores

## ✅ Verificación

Después de los cambios, ejecuta esto para verificar:

```sql
-- Debería mostrar al menos 1 usuario
SELECT id, name, email, role 
FROM profiles 
WHERE role IN ('admin', 'supervisor');
```

## 🐛 Si aún no funciona

1. **Abre la consola del navegador** (F12)
2. **Busca errores** que digan `[Approval]`
3. **Revisa la pestaña Network** para ver si hay errores en las llamadas API
4. **Contáctame** con el mensaje de error exacto

---

## Cambios que hice para solucionar:

1. ✅ **Fallback automático**: Si la Edge Function falla, consulta directamente la tabla profiles
2. ✅ **Mensaje más claro**: "No se encontraron supervisores con rol admin/supervisor"
3. ✅ **Script de debug**: `debug_supervisors.sql` para diagnosticar rápidamente

**Ahora mismo: Ejecuta el script SQL y asigna roles a tus usuarios.** 🚀 
