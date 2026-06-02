# 🚀 Despliegue de Edge Functions para Emails

El sistema ahora usa Edge Functions de Supabase para enviar emails (evitando problemas de CORS).

## 📋 PASOS PARA DESPLEGAR:

### 1️⃣ Obtener tu Project Ref de Supabase

1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. En Settings → General, copia el **Project Reference** (se ve como: `abcdefg`)
4. También copia tu **anon public key** si no la tienes

### 2️⃣ Crear archivo .env

Crea un archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
VITE_RESEND_API_KEY=re_tu_api_key_de_resend
VITE_EMAIL_FROM=tu_email@gmail.com
VITE_APP_URL=http://localhost:5173
```

### 3️⃣ Instalar Supabase CLI (si no lo tienes)

```bash
npm install -g supabase
```

### 4️⃣ Vincular tu proyecto

```bash
npx supabase link --project-ref TU_PROJECT_REF
```

### 5️⃣ Desplegar Edge Functions

```bash
# Desplegar la función de email (la más importante)
npx supabase functions deploy send-email

# Desplegar las otras funciones (opcional, el sistema funciona sin ellas)
npx supabase functions deploy approve-request
npx supabase functions deploy reject-request
npx supabase functions deploy check-request-status
npx supabase functions deploy get-available-supervisors
npx supabase functions deploy create-approval-request
```

### 6️⃣ Configurar variables de entorno en Supabase

```bash
npx supabase secrets set RESEND_API_KEY=re_tu_api_key_de_resend
npx supabase secrets set EMAIL_FROM=tu_email@gmail.com
npx supabase secrets set APP_URL=http://localhost:5173
```

### 7️⃣ Obtener API Key de Resend

1. Ve a [https://resend.com](https://resend.com)
2. Crea una cuenta gratuita
3. Ve a API Keys → Create API Key
4. Copia la API Key (empieza con `re_`)
5. Agrega a tu `.env`: `VITE_RESEND_API_KEY=re_tu_key`

### 8️⃣ Probar el sistema

1. Recarga tu aplicación (`Ctrl+C` y `npm run dev`)
2. Crea una solicitud de aprobación
3. ¡El email debería enviarse! 🎉

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### Error: "Cannot find project ref"
- Ejecuta: `npx supabase link --project-ref TU_PROJECT_REF`

### Error: "Function not found"
- Asegúrate de haber desplegado: `npx supabase functions deploy send-email`

### Error: "RESEND_API_KEY not configured"
- Configura la variable: `npx supabase secrets set RESEND_API_KEY=re_tu_key`

### Emails no llegan
- Verifica que la API Key de Resend sea correcta
- Revisa la consola de Supabase Edge Functions para ver logs
- Verifica que tu email esté verificado en Resend

---

## ✅ ALTERNATIVA RÁPIDA (sin Edge Functions)

Si no quieres desplegar Edge Functions ahora, el sistema **funciona sin emails**:

1. Las solicitudes se crean en la base de datos
2. Los supervisores pueden aprobar manualmente por SQL
3. Solo falta la notificación por email

Puedes aprobar manualmente:

```sql
-- Ver solicitudes pendientes
SELECT * FROM approval_requests WHERE status = 'pending';

-- Aprobar solicitud
UPDATE approval_requests 
SET status = 'approved', 
    approved_by = 'TU_USER_ID',
    approved_at = NOW(),
    response_message = 'Aprobado'
WHERE id = 'REQUEST_ID';
```

---

## 📞 ¿NECESITAS AYUDA?

Si tienes problemas, revisa:
1. Logs de Edge Functions en Supabase Dashboard
2. Consola del navegador para errores
3. Logs de la terminal

El sistema está diseñado para funcionar incluso si los emails fallan, así que no bloqueará el flujo de trabajo. 
