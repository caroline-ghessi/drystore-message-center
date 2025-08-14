import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditRequest {
  userId: string;
  email: string;
  hasAccess: boolean;
  approvalStatus: string;
  roles: string[];
  timestamp: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, email, hasAccess, approvalStatus, roles, timestamp }: AuditRequest = await req.json();

    // Get client IP and user agent from headers
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Call the audit function
    const { error } = await supabase.rpc('audit_access_attempt', {
      user_id_param: userId,
      email_param: email,
      has_access_param: hasAccess,
      approval_status_param: approvalStatus,
      roles_param: roles,
      timestamp_param: timestamp
    });

    if (error) {
      console.error('Error auditing access attempt:', error);
    }

    // Also log directly to system_logs for redundancy
    const { error: logError } = await supabase
      .from('system_logs')
      .insert({
        type: hasAccess ? 'info' : 'warning',
        source: 'auth_security',
        message: hasAccess ? 'User access granted' : 'User access denied',
        details: {
          user_id: userId,
          email: email,
          has_access: hasAccess,
          approval_status: approvalStatus,
          roles: roles,
          ip_address: clientIP,
          user_agent: userAgent,
          timestamp: timestamp
        },
        user_id: userId
      });

    if (logError) {
      console.error('Error logging access attempt:', logError);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in audit-access-attempt:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});