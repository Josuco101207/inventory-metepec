import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verificar autenticación
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Leer y validar datos del body
    const { movementId, supervisorId, notificationMethod = 'email', timeoutMinutes = 30 } = await req.json();
    
    if (!movementId || !supervisorId) {
      return new Response(JSON.stringify({ error: 'movementId y supervisorId son requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Verificar que el supervisor existe y tiene rol adecuado
    const { data: supervisor, error: supervisorError } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .eq('id', supervisorId)
      .single();

    if (supervisorError || !supervisor) {
      return new Response(JSON.stringify({ error: 'Supervisor no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (supervisor.role !== 'admin' && supervisor.role !== 'supervisor') {
      return new Response(JSON.stringify({ error: 'El usuario seleccionado no tiene rol de supervisor' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Verificar que no existe una solicitud activa para este movimiento
    const { data: existingRequest, error: existingError } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('movement_id', movementId)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (existingRequest) {
      return new Response(JSON.stringify({ 
        error: 'Ya existe una solicitud activa para este movimiento',
        existingRequest 
      }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Calcular timeout
    const timeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();

    // 6. Crear la solicitud de aprobación
    const { data: approvalRequest, error: createError } = await supabase
      .from('approval_requests')
      .insert({
        movement_id: movementId,
        requester_id: user.id,
        supervisor_id: supervisorId,
        status: 'pending',
        requested_at: new Date().toISOString(),
        timeout_at: timeoutAt,
        notification_method: notificationMethod,
        notification_status: 'pending',
        metadata: {
          requester_email: user.email,
          supervisor_email: supervisor.email,
          supervisor_name: supervisor.name
        }
      })
      .select()
      .single();

    if (createError) throw createError;

    // 7. Actualizar el movimiento con estado pendiente
    await supabase
      .from('movements')
      .update({
        approval_status: 'pending',
        supervisor_id: supervisorId,
        approval_requested_at: new Date().toISOString(),
        notification_method: notificationMethod
      })
      .eq('id', movementId);

    // 8. Enviar notificación (email)
    let notificationSent = false;
    let notificationError = null;

    if (notificationMethod === 'email' && supervisor.email) {
      try {
        // Aquí iría la lógica de envío de email
        // Por ahora, marcamos como sent (simulado)
        await supabase
          .from('approval_requests')
          .update({ notification_status: 'sent' })
          .eq('id', approvalRequest.id);
        
        notificationSent = true;
      } catch (err) {
        notificationError = err.message;
        await supabase
          .from('approval_requests')
          .update({ notification_status: 'failed' })
          .eq('id', approvalRequest.id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      request: approvalRequest,
      notificationSent,
      notificationError,
      timeoutAt
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Error interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});