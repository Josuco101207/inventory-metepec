# 📧 CONFIGURACIÓN FINAL - SISTEMA DE EMAILS

## 🎉 SISTEMA LISTO PARA ENVIAR EMAILS DE APROBACIÓN

He configurado el sistema para que envíe automáticamente emails cuando se crea una solicitud de aprobación.

---

## 🚀 PASOS PARA ACTIVAR EMAILS (5 minutos):

### PASO 1: Crear cuenta en Resend (Gratis)

1. Ve a [https://resend.com](https://resend.com)
2. Regístrate (es gratis, solo necesitas email)
3. Ve a **Settings > API Keys**
4. Crea nueva API Key
5. Copia la API Key (se ve así: `re_xxxxxxxxxxxx`)

### PASO 2: Configurar variables de entorno

Agrega esto a tu archivo `.env`:

```env
VITE_RESEND_API_KEY=re_tu_api_key_aqui
VITE_EMAIL_FROM=noreply@tudominio.com
VITE_APP_URL=http://localhost:5173
```

**Si no tienes archivo .env:**
- Crea un archivo llamado `.env` en la raíz del proyecto
- Pega las líneas de arriba

### PASO 3: Recargar el servidor

```bash
# Detén el servidor (Ctrl+C)
# Vuelve a iniciarlo
npm run dev
```

### PASO 4: Probar el sistema

1. Recarga la aplicación (F5)
2. Abre ActionModal
3. Cambia a "Solicitar Aprobación"
4. Selecciona supervisor
5. Ingresa motivo
6. Envía solicitud
7. **¡Revisa el email del supervisor!** 📧

---

## 📋 QUÉ INCLUYE EL EMAIL:

### ✅ Contenido del email:

- **Nombre del solicitante**
- **Email del solicitante** 
- **Motivo de la salida**
- **Fecha y hora de la solicitud**
- **Tiempo de expiración (30 min)**
- **Botón para aprobar** ✅
- **Botón para rechazar** ❌
- **Enlaces alternativos** (por si los botones no funcionan)

### 📨 Ejemplo de email:

```
🔔 Nueva Solicitud de Aprobación

Hola [Nombre Supervisor],

Tienes una nueva solicitud de aprobación para una salida de inventario:

Solicitante: Juan Pérez
Email: juan@empresa.com
Motivo: Obra norte, materiales construcción
Fecha: 25/01/2026 16:30
Expira: 25/01/2026 17:00

[✅ Aprobar]  [❌ Rechazar]
```

---

## 🔧 SI NO QUIERES CONFIGURAR EMAIL AHORA:

El sistema funciona perfectamente sin email:
- Las solicitudes se crean en la base de datos
- El polling funciona (verifica estado cada 30s)
- Puedes aprobar manualmente en SQL

### Para aprobar manualmente sin email:

```sql
-- Ver solicitudes pendientes
SELECT * FROM approval_requests WHERE status = 'pending';

-- Aprobar
UPDATE approval_requests 
SET status = 'approved', 
    completed_at = NOW()
WHERE id = 'UUID_DE_LA_SOLICITUD';
```

---

## 🎯 FLUJO COMPLETO CON EMAIL:

1. **Usuario crea solicitud** → Email se envía automáticamente al supervisor
2. **Supervisor recibe email** → Con botones de aprobar/rechazar
3. **Supervisor hace clic en "Aprobar"** → Se abre la aplicación
4. **Sistema aprueba automáticamente** → Usuario puede completar la salida
5. **Usuario recibe notificación** → Solicitud aprobada

---

## 🐛 SOLUCIÓN DE PROBLEMAS:

### Email no llega:

1. **Verifica que la API Key sea correcta**
   ```bash
   echo $VITE_RESEND_API_KEY
   ```

2. **Revisa la consola del navegador (F12)**
   - Busca errores de `[Approval]`

3. **Verifica la carpeta de spam** del email supervisor

4. **Revisa logs en Resend Dashboard**
   - Ve a resend.com > Logs

### Error "No RESEND_API_KEY configured":

- Significa que no configuraste la variable de entorno
- El sistema funciona pero sin enviar emails
- Configura el `.env` como se indica arriba

---

## 📊 VERIFICACIÓN:

Para verificar que los emails se enviaron correctamente:

```sql
-- Ver solicitudes con estado de notificación
SELECT 
  id,
  status,
  notification_status,
  requested_at,
  metadata->>'supervisor_email' as supervisor_email
FROM approval_requests 
ORDER BY requested_at DESC 
LIMIT 10;
```

**Estados de notificación:**
- `pending` - No enviado aún
- `sent` - Enviado exitosamente ✅
- `failed` - Error al enviar ❌

---

## 🎨 PERSONALIZACIÓN (Opcional):

### Cambiar el diseño del email:

Edita la función `sendApprovalEmail` en `ApprovalContext.jsx` (líneas 20-60)

### Cambiar el tiempo de expiración:

En `ActionModal.jsx`, línea 119:
```javascript
timeoutMinutes: 30  // Cambia a otro valor (ej: 60 = 1 hora)
```

### Cambiar el remitente del email:

En `.env`:
```env
VITE_EMAIL_FROM=otro_email@tudominio.com
```

---

## 🚀 LISTO PARA PROBAR:

1. **Configura Resend** (sigue los pasos de arriba)
2. **Agrega variables al .env**
3. **Recarga el servidor**
4. **Crea una solicitud de prueba**
5. **¡Revisa el email del supervisor!** 📧

---

**¿Necesitas ayuda con la configuración de Resend? Dime y te guío paso a paso.** 🚀