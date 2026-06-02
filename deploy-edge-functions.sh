#!/bin/bash

# Script para desplegar Edge Functions de Supabase manualmente
# Requiere: supabase CLI instalado y proyecto vinculado

echo "🚀 Desplegando Edge Functions..."

# Reemplaza con tu project ref de Supabase
PROJECT_REF="YOUR_PROJECT_REF_HERE"

# Vincular proyecto (si no está vinculado)
npx supabase link --project-ref $PROJECT_REF

# Desplegar cada Edge Function
echo "📧 Desplegando send-email..."
npx supabase functions deploy send-email

echo "✅ Desplegando approve-request..."
npx supabase functions deploy approve-request

echo "❌ Desplegando reject-request..."
npx supabase functions deploy reject-request

echo "📋 Desplegando check-request-status..."
npx supabase functions deploy check-request-status

echo "👥 Desplegando get-available-supervisors..."
npx supabase functions deploy get-available-supervisors

echo "📝 Desplegando create-approval-request..."
npx supabase functions deploy create-approval-request

echo "✨ ¡Edge Functions desplegadas exitosamente!"

# Configurar variables de entorno para Edge Functions
echo "🔧 Configurando variables de entorno..."

# Lee las variables de tu archivo .env local
if [ -f .env ]; then
  source .env
  
  npx supabase secrets set RESEND_API_KEY=$VITE_RESEND_API_KEY
  npx supabase secrets set EMAIL_FROM=$VITE_EMAIL_FROM
  npx supabase secrets set APP_URL=$VITE_APP_URL
  
  echo "✅ Variables de entorno configuradas"
else
  echo "⚠️  No se encontró archivo .env"
  echo "Por favor configura las variables manualmente:"
  echo "npx supabase secrets set RESEND_API_KEY=tu_api_key"
  echo "npx supabase secrets set EMAIL_FROM=tu_email"
  echo "npx supabase secrets set APP_URL=tu_app_url"
fi

echo "🎉 ¡Despliegue completado!" 
