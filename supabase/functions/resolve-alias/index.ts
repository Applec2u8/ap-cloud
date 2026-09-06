// Supabase Edge Function: resolve-alias
// Deploy with: supabase functions deploy resolve-alias
//
// Resolves a named link alias to its configured target URL.
// By default it transparently proxies the target JSON response so the
// client-facing alias URL never changes even when the target rotates.
//
// The proxy mode always validates that the upstream body is valid JSON
// and re-emits it with Content-Type: application/json regardless of what
// the upstream server declares.  This prevents client auto-updaters from
// breaking when CDN/storage returns text/html or similar incorrect types.
//
// Query parameters (all required):
//   repo_id  — UUID of the repository (same as in latest-version)
//   slug     — The alias slug, e.g. "my-app-updater"
//
// Optional:
//   mode=redirect  — Instead of proxying, return a 302 to target_url.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, apikey, Content-Type',
};

Deno.serve(async (req: Request) => {
  // ── CORS preflight ────────────────────────────────────────────────────────
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
    // ── 1. Parse & validate required query parameters ─────────────────────
    const url = new URL(req.url);
    const repoId = url.searchParams.get('repo_id') ?? url.searchParams.get('repo');
    const slug = url.searchParams.get('slug');
    const mode = url.searchParams.get('mode'); // "redirect" | null (proxy)

    if (!repoId || repoId.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Missing required query parameter: repo_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!slug || slug.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Missing required query parameter: slug' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 2. Look up the alias in the database ──────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    const { data: alias, error: dbError } = await supabase
      .from('link_aliases')
      .select('target_url, description')
      .eq('repository_id', repoId)
      .eq('slug', slug.trim())
      .single();

    if (dbError || !alias) {
      return new Response(
        JSON.stringify({ error: `Alias "${slug}" not found for this repository.` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { target_url } = alias;

    // ── 3a. Redirect mode ─────────────────────────────────────────────────
    if (mode === 'redirect') {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: target_url,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ── 3b. Proxy mode (default) ──────────────────────────────────────────
    // Fetch the target URL and transparently forward its JSON body.
    // The alias URL stays permanently unchanged; only the DB mapping changes.
    //
    // IMPORTANT: We always validate the body is well-formed JSON and force
    // Content-Type: application/json in the outbound response.  This prevents
    // client auto-updaters from failing when a CDN or storage layer returns
    // an incorrect Content-Type (e.g. text/html) for the same resource.
    const upstream = await fetch(target_url, {
      headers: { 'User-Agent': 'AP-Cloud-ResolveAlias/1.0' },
    });

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({
          error: `Target URL returned ${upstream.status}. Check the alias configuration.`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await upstream.text();

    // Validate that the upstream body is parseable JSON before forwarding.
    // If it is not, return a 502 so the caller gets a clear error instead of
    // an HTML page or other non-JSON noise that would break JSON.parse() on
    // the client side.
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({
          error: 'Target URL did not return valid JSON. Check the alias configuration.',
          upstream_status: upstream.status,
          upstream_content_type: upstream.headers.get('Content-Type') ?? 'unknown',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Re-serialize to ensure a clean, compact JSON output with no BOM or
    // leading whitespace that could trip up strict JSON parsers.
    const cleanBody = JSON.stringify(parsedJson);

    return new Response(cleanBody, {
      status: 200,
      headers: {
        ...corsHeaders,
        // Always application/json regardless of what the upstream declared.
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        // Surface which alias resolved this so clients can debug.
        'X-Alias-Slug': slug,
        'X-Alias-Repo': repoId,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
