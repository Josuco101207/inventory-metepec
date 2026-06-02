#!/bin/bash

# Script para desplegar el sistema de aprobación
# Uso: ./deploy-approval-system.sh

echo "🚀 Desplegando Sistema de Aprobación por Supervisor"
echo "=================================================="

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar si Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI no está instalado"
    echo "Instálalo desde: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Verificar si estamos logueados
print_warning "Verificando autenticación con Supabase..."
if ! supabase projects list &> /dev/null; then
    print_error "No estás autenticado con Supabase CLI"
    echo "Ejecuta: supabase login"
    exit 1
fi

print_success "Autenticación correcta"

# Listar proyectos disponibles
echo ""
print_warning "Proyectos disponibles:"
supabase projects list

# Pedir al usuario que seleccione un proyecto
echo ""
read -p "Ingresa el Project ID o presiona Enter para usar el proyecto actual: " PROJECT_ID

if [ -n "$PROJECT_ID" ]; then
    print_warning "Conectando al proyecto: $PROJECT_ID"
    supabase link --project-ref "$PROJECT_ID"
fi

# Desplegar Edge Functions
echo ""
print_warning "Desplegando Edge Functions..."
FUNCTIONS=(
    "create-approval-request"
    "approve-request"
    "reject-request"
    "check-request-status"
    "get-available-supervisors"
    "send-email"
)

for func in "${FUNCTIONS[@]}"; do
    echo "Desplegando: $func"
    if supabase functions deploy "$func" --no-verify-jwt; then
        print_success "✅ $func desplegada"
    else
        print_error "❌ Error desplegando $func"
    fi
done

echo ""
print_success "🎉 Despliegue completado!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Ejecuta las migraciones SQL en el Dashboard de Supabase"
echo "2. Configura las variables de entorno para email (opcional)"
echo "3. Prueba el sistema en la aplicación"
echo ""
echo "📄 Archivo de migración: supabase_migration_approval_system.sql" 
