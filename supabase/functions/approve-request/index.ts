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

    // 2. Verificar que el usuario tiene rol de supervisor
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || (profile?.role !== 'admin' && profile?.role !== 'supervisor')) {
      return new Response(JSON.stringify({ error: 'Solo supervisores pueden aprobar solicitudes' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Leer y validar datos del body
    const { requestId, notes } = await req.json();
    
    if (!requestId) {
      return new Response(JSON.stringify({ error: 'requestId es requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Obtener la solicitud de aprobación
    const { data: request, error: requestError } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return new Response(JSON.stringify({ error: 'Solicitud no encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Verificar que la solicitud está pendiente
    if (request.status !== 'pending') {
      return new Response(JSON.stringify({ 
        error: 'La solicitud ya fue procesada',
        currentStatus: request.status 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Verificar que no ha expirado
    if (new Date(request.timeout_at) < new Date()) {
      // Marcar como expirada si aún está pendiente
      await supabase
        .from('approval_requests')
        .update({ 
          status: 'expired', 
          completed_at: new Date().toISOString(),
          notification_status: 'expired'
        })
        .eq('id', requestId);

      return new Response(JSON.stringify({ error: 'La solicitud ha expirado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7. Verificar que el usuario es el supervisor asignado (o admin)
    if (request.supervisor_id !== user.id && profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'No eres el supervisor asignado a esta solicitud' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 8. Actualizar la solicitud a aprobada
    const { data: updatedRequest, error: updateError } = await supabase
      .from('approval_requests')
      .update({
        status: 'approved',
        completed_at: new Date().toISOString(),
        rejection_reason: notes,
        metadata: {
          ...request.metadata,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        }
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 9. Actualizar el movimiento
    await supabase
      .from('movements')
      .update({
        approval_status: 'approved',
        supervisor_id: user.id,
        approval_completed_at: new Date().toISOString(),
        approval_notes: notes
      })
      .eq('id', request.movement_id);

    // 10. Notificar al solicitante (aquí iría la lógica de email)
    // Por ahora, solo registramos en metadata

    return new Response(JSON.stringify({ 
      success: true,
      request: updatedRequest
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Error interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});