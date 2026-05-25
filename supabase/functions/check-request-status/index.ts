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

    // 2. Obtener requestId de la URL
    const url = new URL(req.url);
    const requestId = url.pathname.split('/').pop();

    if (!requestId) {
      return new Response(JSON.stringify({ error: 'requestId es requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Obtener la solicitud de aprobación
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

    // 4. Verificar que el usuario tiene permiso para ver esta solicitud
    const isRequester = request.requester_id === user.id;
    const isSupervisor = request.supervisor_id === user.id;
    
    // Verificar rol de admin/supervisor
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';
    const isSupervisorRole = profile?.role === 'supervisor';

    if (!isRequester && !isSupervisor && !isAdmin && !isSupervisorRole) {
      return new Response(JSON.stringify({ error: 'No tienes permiso para ver esta solicitud' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Verificar si la solicitud ha expirado (si aún está pendiente)
    let status = request.status;
    if (status === 'pending' && new Date(request.timeout_at) < new Date()) {
      // Actualizar a expirada automáticamente
      await supabase
        .from('approval_requests')
        .update({ 
          status: 'expired', 
          completed_at: new Date().toISOString(),
          notification_status: 'expired'
        })
        .eq('id', requestId);
      
      status = 'expired';
    }

    // 6. Retornar información de la solicitud
    return new Response(JSON.stringify({ 
      success: true,
      request: {
        ...request,
        status // Status actualizado si expiró
      },
      canApprove: isSupervisor || isAdmin,
      canReject: isSupervisor || isAdmin
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Error interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});