// Supabase Edge Function: track-analytics
// Captures repository views and release/source code downloads.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import UAParser from 'https://esm.sh/ua-parser-js@1.0.36';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, apikey, Content-Type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { action, repo_id, version, download_type } = await req.json();
    
    if (!repo_id) {
       return new Response(JSON.stringify({ error: 'repo_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!, // Anon key is fine because RLS allows anonymous inserts
    );
    
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // ── Repository View Tracking ──
    if (action === 'view') {
       const { error } = await supabase.from('repository_views').insert({
         repository_id: repo_id,
         visitor_ip: ip,
         user_agent: userAgent
       });
       if (error) throw error;
       return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } 
    
    // ── Download Tracking ──
    if (action === 'download') {
       if (!download_type) throw new Error('download_type required (source_code or release_binary)');
       
       const parser = new UAParser(userAgent);
       const device = parser.getDevice();
       const os = parser.getOS();
       
       let deviceType = 'Desktop/PC';
       if (device.type === 'mobile') deviceType = 'Mobile';
       else if (device.type === 'tablet') deviceType = 'Tablet';
       else if (device.type === 'smarttv') deviceType = 'Smart TV';

       const browserOs = os.name ? `${os.name} ${os.version || ''}`.trim() : 'Unknown';

       const { error } = await supabase.from('download_logs').insert({
         repository_id: repo_id,
         download_type,
         version: version || null,
         device_type: deviceType,
         browser_os: browserOs,
         user_ip: ip
       });
       if (error) throw error;
       return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
