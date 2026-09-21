// Supabase Edge Function: latest-version
// Deploy with: supabase functions deploy latest-version
//
// Returns JSON with the latest public release for a given repository.
// The caller MUST supply ?repo_id=<uuid> to scope the query; without it the
// request is rejected with 400 Bad Request.
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
    // ------------------------------------------------------------------
    // 1. Extract and validate the repository identifier from the URL.
    //    Accepted parameter name: repo_id (preferred) or repo (alias).
    //    Example: /functions/v1/latest-version?repo_id=<uuid>
    // ------------------------------------------------------------------
    const url = new URL(req.url);
    const repoId = url.searchParams.get('repo_id') ?? url.searchParams.get('repo');

    if (!repoId || repoId.trim() === '') {
      return new Response(
        JSON.stringify({
          error: 'Missing required query parameter: repo_id',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ------------------------------------------------------------------
    // 2. Query the releases table scoped to the requested repository.
    // ------------------------------------------------------------------
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    const { data, error } = await supabase
      .from('releases')
      .select('app_name, version, filename, size, public_url, release_notes, created_at')
      .eq('repository_id', repoId)
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

    // ------------------------------------------------------------------
    // 3. Handle 'action=download' mode
    // ------------------------------------------------------------------
    const action = url.searchParams.get('action');
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (action === 'download') {
      // 3.1 Log the Binary Download
      try {
        const { error: logError } = await supabase.from('download_logs').insert({
          repository_id: repoId,
          download_type: 'release_binary', 
          version: data.version,
          device_type: 'Desktop/PC',
          browser_os: 'Windows', // AHK is Windows-based
          user_ip: ip
        });
        if (logError) console.error('Error logging binary download:', logError);
      } catch (logErr) {
        console.error('Error in binary logging block:', logErr);
      }

      // 3.2 Redirect to the actual Storage URL
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: data.public_url,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ------------------------------------------------------------------
    // 4. Handle Version Check mode (default)
    // ------------------------------------------------------------------
    
    // Construct a proxy download URL that points back to this function with action=download
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || url.origin;
    const proxyDownloadUrl = `${supabaseUrl}/functions/v1/latest-version?repo_id=${repoId}&action=download`;

    const payload = {
      version: data.version,
      url: proxyDownloadUrl, // Replace direct storage URL with proxy URL
      notes: data.release_notes ?? '',
      filename: data.filename,
      size: data.size,
      app_name: data.app_name,
      released_at: data.created_at,
    };

    // Log the Version Check
    try {
      const { error: logError } = await supabase.from('download_logs').insert({
        repository_id: repoId,
        download_type: 'version_check', 
        version: data.version,
        device_type: 'Desktop/PC',
        browser_os: 'Windows', // AHK is Windows-based
        user_ip: ip
      });
      if (logError) console.error('Error logging version check:', logError);
    } catch (logErr) {
      console.error('Error in version check logging block:', logErr);
    }

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
