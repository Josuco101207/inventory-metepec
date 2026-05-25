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

    // 2. Leer datos del email
    const { to, subject, html, text } = await req.json();
    
    if (!to || !subject || (!html && !text)) {
      return new Response(JSON.stringify({ error: 'to, subject y content (html o text) son requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Configuración de email (puedes usar Resend, SendGrid, etc.)
    // Por ahora, simulamos el envío para desarrollo
    const emailConfig = {
      from: Deno.env.get('EMAIL_FROM') || 'noreply@dicrejart.com',
      to,
      subject,
      html,
      text
    };

    // 4. Intentar enviar email usando el servicio configurado
    let emailSent = false;
    let emailError = null;
    let messageId = null;

    try {
      // Ejemplo con Resend (comentado - requiere configuración)
      /*
      const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
      const { data, error } = await resend.emails.send({
        from: emailConfig.from,
        to: [emailConfig.to],
        subject: emailConfig.subject,
        html: emailConfig.html,
      });
      
      if (error) throw error;
      messageId = data?.id;
      emailSent = true;
      */

      // SIMULACIÓN para desarrollo
      console.log('[Send-Email] Email would be sent:', {
        to: emailConfig.to,
        subject: emailConfig.subject,
        from: emailConfig.from,
        timestamp: new Date().toISOString()
      });
      
      messageId = `sim_${Date.now()}`;
      emailSent = true;

    } catch (err) {
      emailError = err.message;
      console.error('[Send-Email] Error sending email:', err);
    }

    // 5. Registrar intento de envío en auditoría
    try {
      await supabase.from('audit_log').insert({
        entity_type: 'email',
        entity_id: messageId,
        action: emailSent ? 'sent' : 'failed',
        user_id: user.id,
        new_values: {
          to,
          subject,
          sent: emailSent,
          error: emailError
        },
        details: emailSent ? 'Email enviado exitosamente' : `Error enviando email: ${emailError}`
      });
    } catch (auditError) {
      console.error('[Send-Email] Error logging to audit:', auditError);
    }

    // 6. Retornar respuesta
    if (emailSent) {
      return new Response(JSON.stringify({ 
        success: true,
        messageId,
        message: 'Email enviado exitosamente'
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false,
        error: emailError || 'Error desconocido al enviar email'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Error interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});