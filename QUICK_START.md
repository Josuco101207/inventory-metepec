# 🚀 Inicio Rápido - Sistema de Aprobación

## Paso 1: Ejecutar Migraciones SQL (Manual)

1. Abre el [Dashboard de Supabase](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **SQL Editor** (icono de terminal en la barra lateral)
4. Copia el contenido del archivo `supabase_migration_approval_system.sql`
5. Pégalo en el editor
6. Haz clic en **Run** ▶️
7. Verifica que no haya errores

## Paso 2: Verificar Tablas Creadas

En el Dashboard de Supabase:
1. Ve a **Table Editor** (icono de tabla)
2. Deberías ver las nuevas tablas:
   - `approval_requests`
   - `audit_log`
3. En la tabla `movements`, verifica las nuevas columnas:
   - `approval_status`
   - `supervisor_id`
   - `approval_requested_at`
   - `approval_completed_at`
   - `approval_notes`

## Paso 3: Desplegar Edge Functions

### Opción A: Usando el script (si tienes CLI configurada)

```bash
# En Git Bash o terminal
chmod +x deploy-approval-system.sh
./deploy-approval-system.sh
```

### Opción B: Despliegue manual (recomendado)

1. Ve al [Dashboard de Supabase](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Edge Functions** (icono de rayo en la barra lateral)
4. Para cada función, haz clic en **"New Edge Function"** y pega el código:

**Funciones a crear:**

1. **create-approval-request**
   - Copia: `supabase/functions/create-approval-request/index.ts`
   - Nombre: `create-approval-request`

2. **approve-request**
   - Copia: `supabase/functions/approve-request/index.ts`
   - Nombre: `approve-request`

3. **reject-request**
   - Copia: `supabase/functions/reject-request/index.ts`
   - Nombre: `reject-request`

4. **check-request-status**
   - Copia: `supabase/functions/check-request-status/index.ts`
   - Nombre: `check-request-status`

5. **get-available-supervisors**
   - Copia: `supabase/functions/get-available-supervisors/index.ts`
   - Nombre: `get-available-supervisors`

6. **send-email**
   - Copia: `supabase/functions/send-email/index.ts`
   - Nombre: `send-email`

## Paso 4: Configurar Variables de Entorno (Opcional)

Para notificaciones por email reales:

1. En el Dashboard de Supabase → **Settings** → **Edge Functions**
2. Agrega estas variables:
   ```
   RESEND_API_KEY=tu_api_key
   EMAIL_FROM=noreply@tudominio.com
   ```

## Paso 5: Verificar Roles de Usuario

Asegúrate de que los usuarios tengan los roles correctos en la tabla `profiles`:

```sql
-- Ver roles actuales
SELECT id, name, email, role FROM profiles;

-- Actualizar rol si es necesario
UPDATE profiles SET role = 'supervisor' WHERE email = 'supervisor@empresa.com';
UPDATE profiles SET role = 'admin' WHERE email = 'admin@empresa.com';
```

## Paso 6: Probar el Sistema

1. Inicia tu aplicación:
   ```bash
   npm run dev
   ```

2. Abre `InventoryView`

3. Haz clic en el botón de salida para algún item

4. En el `ActionModal`:
   - Prueba el modo "Credenciales Directas" (existente)
   - Cambia a "Solicitar Aprobación" (nuevo)
   - Selecciona un supervisor
   - Envía la solicitud

5. Verifica que:
   - La solicitud se crea en `approval_requests`
   - El polling funciona (estado se actualiza)
   - Puedes aprobar/rechazar como supervisor

## 🔍 Verificación

### Consultas SQL útiles:

```sql
-- Ver solicitudes recientes
SELECT * FROM approval_requests ORDER BY requested_at DESC LIMIT 10;

-- Ver movimientos con aprobación
SELECT * FROM movements WHERE approval_status IS NOT NULL;

-- Ver auditoría
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;

-- Ver supervisores disponibles
SELECT * FROM get_available_supervisors();
```

## 🐛 Troubleshooting

### Error: "function does not exist"
- Las Edge Functions no están desplegadas
- Verifica en el Dashboard de Supabase → Edge Functions

### Error: "relation does not exist"
- Las migraciones SQL no se ejecutaron
- Ejecuta el archivo `supabase_migration_approval_system.sql`

### Error: "permission denied"
- El usuario no tiene el rol correcto
- Verifica y actualiza roles en tabla `profiles`

### Polling no funciona
- Verifica que `ApprovalProvider` esté en `App.jsx`
- Revisa la consola del navegador para errores

## 📞 ¿Necesitas ayuda?

Revisa el documento completo: `APPROVAL_SYSTEM_IMPLEMENTATION.md`

---

**¡Listo para probar! 🎉**