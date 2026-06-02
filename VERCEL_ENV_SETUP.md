# 🔧 Configuración de Variables de Entorno en Vercel

Tu app ya está hosteada en Vercel, pero necesitas configurar las variables de entorno para producción.

## 📋 VARIABLES QUE NECESITAS CONFIGURAR EN VERCEL:

Ve a tu proyecto en Vercel → Settings → Environment Variables y agrega:

### Variables del Frontend:

```
VITE_SUPABASE_URL=https://rpaihoyotvinucbelaew.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwYWlob3lvdHZpbnVjYmVsYWV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTgyNzksImV4cCI6MjA5NDA5NDI3OX0.uARuwulS8yyA-676zxNdvaCHNB6ggEErQDjTQ0zE278
VITE_EMAIL_FROM=onboarding@resend.dev
VITE_APP_URL=TU_URL_DE_VERCEL  # ← CAMBIAR ESTO
```

## 🚨 IMPORTANTE - VITE_APP_URL:

Debes cambiar `VITE_APP_URL` a tu URL de producción en Vercel:

- Si tu URL es: `https://tu-app.vercel.app`
- Entonces: `VITE_APP_URL=https://tu-app.vercel.app`

## 📝 PASOS EN VERCEL:

1. Ve a [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Agrega cada variable con su valor
5. **IMPORTANTE:** Selecciona los entornos:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

6. Haz clic en **Save**

7. Ve a **Deployments** → **Redeploy** para aplicar los cambios

## ✅ VERIFICACIÓN:

Después de configurar las variables:

1. Ve a tu URL de producción
2. Abre el ActionModal
3. Prueba crear una solicitud de aprobación
4. ¡El email debería enviarse! 📧

## 🔍 ¿NO SABES TU URL DE VERCEL?

En Vercel Dashboard:
1. Ve a tu proyecto
2. En la parte superior verás algo como: `https://tu-proyecto.vercel.app`
3. Esa es tu URL de producción

---

## 📧 NOTA SOBRE EMAILS:

El dominio `onboarding@resend.dev` solo permite enviar emails a TU email registrado en Resend.

Si quieres enviar emails a otros usuarios:
1. Ve a [https://resend.com/domains](https://resend.com/domains)
2. Verifica tu dominio personal
3. Cambia `VITE_EMAIL_FROM` a tu email verificado
4. Actualiza también en Supabase: `npx supabase secrets set EMAIL_FROM=tu_email@tu_dominio.com` 
