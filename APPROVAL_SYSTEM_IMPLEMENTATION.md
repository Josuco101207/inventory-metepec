# Sistema de Aprobación por Supervisor - Guía de Implementación

## 📋 Resumen

Se ha implementado un sistema completo de aprobación por supervisor para salidas de inventario sin factura. El sistema permite dos métodos de autorización:

1. **Método Directo**: Credenciales de supervisor (existente)
2. **Método de Aprobación**: Selección de supervisor con flujo de aprobación asíncrono (nuevo)

## 🗄️ Paso 1: Migraciones de Base de Datos

Ejecuta el siguiente script SQL en el Supabase Dashboard > SQL Editor:

```bash
# Archivo: supabase_migration_approval_system.sql
```

Este script:
- Extiende la tabla `movements` con campos de aprobación
- Crea la tabla `approval_requests` para gestionar solicitudes
- Crea la tabla `audit_log` para auditoría
- Configura RLS (Row Level Security) policies
- Crea índices para performance
- Configura triggers automáticos

## ⚡ Paso 2: Edge Functions

Las siguientes Edge Functions deben ser desplegadas en Supabase:

### Funciones Creadas:

1. **`create-approval-request`** - Crea solicitudes de aprobación
2. **`approve-request`** - Aprueba solicitudes (solo supervisores)
3. **`reject-request`** - Rechaza solicitudes (solo supervisores)
4. **`check-request-status`** - Verifica estado de solicitudes
5. **`get-available-supervisors`** - Lista supervisores disponibles
6. **`send-email`** - Envía notificaciones por email

### Despliegue:

```bash
# Desde la raíz del proyecto
supabase functions deploy create-approval-request
supabase functions deploy approve-request
supabase functions deploy reject-request
supabase functions deploy check-request-status
supabase functions deploy get-available-supervisors
supabase functions deploy send-email
```

## 🔧 Paso 3: Configuración de Variables de Entorno

Agrega las siguientes variables de entorno en tu proyecto `.env`:

```env
# Para el servicio de email (opcional - configurar cuando se use real)
RESEND_API_KEY=tu_api_key_de_resend
EMAIL_FROM=noreply@tudominio.com
```

## 🎨 Paso 4: Componentes Frontend

### Nuevos Componentes Creados:

1. **`SupervisorSelector.jsx`** - Selector de supervisores con búsqueda
2. **`ApprovalStatusBadge.jsx`** - Badge de estado de aprobación
3. **`ApprovalNotificationPanel.jsx`** - Panel de notificaciones
4. **`ActionModal.jsx`** - Actualizado con nuevo flujo

### Contextos Actualizados:

1. **`ApprovalContext.jsx`** - Contexto para manejo de solicitudes
2. **`SalidaAuthContext.jsx`** - Actualizado con método APPROVAL
3. **`App.jsx`** - ApprovalProvider agregado a la jerarquía

## 🚀 Paso 5: Flujo de Usuario

### Para Salidas con Factura (Existente):

1. Usuario carga factura en `InvoiceAIView`
2. Sistema procesa factura con IA
3. Autorización automática de 15 minutos
4. Usuario registra salida en `ActionModal`

### Para Salidas sin Factura (Nuevo):

#### Opción A: Credenciales Directas (Existente):

1. Usuario abre `ActionModal`
2. Ingresa credenciales de supervisor
3. Sistema valida y autoriza inmediatamente
4. Usuario registra salida

#### Opción B: Flujo de Aprobación (Nuevo):

1. Usuario abre `ActionModal`
2. Selecciona "Solicitar Aprobación"
3. Elige supervisor de la lista
4. Sistema envía solicitud de aprobación
5. Supervisor recibe email con enlaces de aprobar/rechazar
6. Usuario ve estado en tiempo real (polling inteligente)
7. Si es aprobada: Usuario puede completar la salida
8. Si es rechazada/expirada: Usuario puede crear nueva solicitud

## 🔒 Paso 6: Configuración de Seguridad

### Roles de Usuario:

Asegúrate de que los usuarios tengan los roles correctos en la tabla `profiles`:

- **`admin`** - Puede aprobar cualquier solicitud
- **`supervisor`** - Puede aprobar solicitudes asignadas
- **`user`** - Solo puede crear solicitudes

### Políticas RLS:

El sistema incluye políticas RLS automáticas:
- Solo usuarios autenticados pueden crear solicitudes
- Solo admin/supervisor pueden aprobar/rechazar
- Cada usuario ve solo sus propias solicitudes
- Audit log accesible solo para admin/supervisor

## 📧 Paso 7: Configuración de Email (Opcional)

Para activar las notificaciones por email:

1. **Opción A: Resend** (Recomendado)
   - Crea cuenta en [resend.com](https://resend.com)
   - Obtén API key
   - Configura variable `RESEND_API_KEY`
   - Actualiza la Edge Function `send-email` para usar Resend

2. **Opción B: SendGrid**
   - Similar configuración con API key de SendGrid

3. **Opción C: Otro proveedor**
   - Adapta la Edge Function `send-email`

Mientras tanto, el sistema usa simulación para desarrollo.

## 🧪 Paso 8: Pruebas

### Pruebas Manuales:

1. **Prueba de Selección de Supervisor:**
   - Abre `ActionModal`
   - Cambia a "Solicitar Aprobación"
   - Verifica que la lista de supervisores se carga
   - Selecciona un supervisor
   - Envía solicitud

2. **Prueba de Polling:**
   - Crea una solicitud
   - Observa el polling inteligente (5s → 10s → 20s → 30s)
   - Verifica que los estados se actualizan

3. **Prueba de Aprobación:**
   - Como supervisor, aprueba una solicitud
   - Verifica que el solicitante recibe notificación
   - Intenta completar la salida

4. **Prueba de Rechazo:**
   - Como supervisor, rechaza una solicitud
   - Verifica que se muestra motivo
   - Solicitante puede crear nueva solicitud

### Pruebas de Seguridad:

1. Intenta aprobar sin rol de supervisor (debe fallar)
2. Intenta ver solicitudes de otros usuarios (debe fallar)
3. Verifica que las auditorías se registran correctamente

## 📊 Paso 9: Monitoreo

### Métricas Disponibles:

El sistema registra automáticamente:
- Solicitudes creadas/aprobadas/rechazadas/expiradas
- Tiempos de respuesta de supervisores
- Tasa de expiración de solicitudes
- Fallos de envío de email

### Consultas Útiles:

```sql
-- Solicitudes por estado
SELECT status, COUNT(*) FROM approval_requests GROUP BY status;

-- Tiempo promedio de aprobación
SELECT AVG(EXTRACT(EPOCH FROM (completed_at - requested_at))/60) as avg_minutes
FROM approval_requests WHERE status = 'approved';

-- Solicitudes por supervisor
SELECT supervisor_id, COUNT(*) FROM approval_requests 
GROUP BY supervisor_id ORDER BY COUNT(*) DESC;
```

## 🔮 Futuras Mejoras

### Integraciones Planeadas:

1. **Slack/Teams Webhooks**
   - Ya preparada la arquitectura
   - Agregar canales de notificación adicionales

2. **Dashboard de Aprobaciones**
   - Vista dedicada para supervisores
   - Métricas y estadísticas

3. **Notificaciones Push**
   - Notificaciones en tiempo real en navegador
   - Integración con Service Workers

4. **Reglas de Escalado**
   - Escalar automáticamente a otros supervisores
   - Configuración por departamento/ubicación

## 🐛 Solución de Problemas

### Problemas Comunes:

1. **Edge Functions no responden:**
   - Verifica que estén desplegadas
   - Revisa logs en Supabase Dashboard
   - Verifica variables de entorno

2. **Polling no funciona:**
   - Verifica que `ApprovalContext` está en la jerarquía
   - Revisa consola del navegador para errores

3. **Emails no llegan:**
   - Verifica configuración de API key
   - Revisa logs de la Edge Function `send-email`
   - Verifica carpeta de spam

4. **Permisos denegados:**
   - Verifica políticas RLS en base de datos
   - Confirma roles de usuario en tabla `profiles`
   - Revisa logs de auditoría

## 📞 Soporte

Para problemas o preguntas:
1. Revisa logs de Supabase Dashboard
2. Verifica consola del navegador
3. Consulta tabla `audit_log` para trazabilidad
4. Revisa este documento para solución de problemas

---

**Estado de Implementación:** ✅ Completo
**Fecha:** 2025-01-XX
**Versión:** 1.0.0 
