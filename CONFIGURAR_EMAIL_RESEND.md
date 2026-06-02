# 📧 Configurar Resend para envío de emails

## Paso 1: Crear cuenta en Resend (Gratis)

1. Ve a [https://resend.com](https://resend.com)
2. Regístrate (es gratis)
3. Ve a **Settings > API Keys**
4. Crea una nueva API Key
5. Copia la API Key (se ve así: `re_xxxxxxxxxxxx`)

## Paso 2: Configurar variable de entorno

Agrega esto a tu archivo `.env`:

```env
VITE_RESEND_API_KEY=re_tu_api_key_aqui
VITE_EMAIL_FROM=noreply@tudominio.com
VITE_APP_URL=http://localhost:5173
```

## Paso 3: Verificar dominio (Opcional pero recomendado)

1. En Resend, ve a **Domains**
2. Agrega tu dominio
3. Sigue las instrucciones para verificar DNS
4. Si no quieres verificar dominio, Resend usa un dominio por defecto

## Paso 4: Probar

Después de configurar, el sistema enviará emails automáticamente cuando:
- Se cree una solicitud de aprobación
- Se apruebe una solicitud
- Se rechace una solicitud
- Una solicitud expire

---

**Una vez que tengas la API Key, avísame y configuro el sistema para usarla.** 🚀 
