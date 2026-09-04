// Supabase Edge Function: latest-version
// Deploy with: supabase functions deploy latest-version
//
// Returns JSON with the latest public release for the Python auto-updater.
// CORS headers allow any origin to call this endpoint.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, apikey, Content-Type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    const { data, error } = await supabase
      .from('releases')
      .select('app_name, version, filename, size, public_url, release_notes, created_at')
      .eq('is_latest', true)
      .eq('is_public', true)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: 'No public latest release found.' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payload = {
      version:     data.version,
      url:         data.public_url,
      notes:       data.release_notes ?? '',
      filename:    data.filename,
      size:        data.size,
      app_name:    data.app_name,
      released_at: data.created_at,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
