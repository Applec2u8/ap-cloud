// supabase/functions/_shared/auth.ts
// Shared authentication helper for Edge Functions that require admin access.
//
// Usage:
//   import { requireAuth } from '../_shared/auth.ts';
//   const { user, errorResponse } = await requireAuth(req);
//   if (errorResponse) return errorResponse;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface AuthResult {
  /** Authenticated user object — present only when auth succeeds */
  user: { id: string; email?: string } | null;
  /** Pre-built 401 Response — return this immediately if truthy */
  errorResponse: Response | null;
}

/**
 * Extracts and validates the Bearer token from the Authorization header.
 * Returns the authenticated user or a ready-to-return 401 Response.
 *
 * The token is validated against Supabase Auth (supabase.auth.getUser),
 * which verifies the JWT signature and expiry server-side — no client-side
 * comparisons, no hardcoded secrets.
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ error: 'Unauthorized — missing or malformed Authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      ),
    };
  }

  const token = authHeader.replace('Bearer ', '').trim();

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ error: 'Server configuration error — missing Supabase env vars' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      ),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ error: 'Unauthorized — invalid or expired token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      ),
    };
  }

  return { user: data.user, errorResponse: null };
}
