import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { repoId, commitHash } = await req.json();

    if (!repoId || !commitHash) {
      return new Response(JSON.stringify({ error: 'Missing repoId or commitHash' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const BUCKET = 'repo-storage';

    // List all files in the commit folder
    const folderPath = `${repoId}/${commitHash}`;
    const { data: list, error: listError } = await supabase.storage.from(BUCKET).list(`${folderPath}/chunks`);
    
    if (listError) {
      console.error('List error:', listError);
    }

    const filesToRemove = [];
    if (list && list.length > 0) {
      for (const file of list) {
        filesToRemove.push(`${folderPath}/chunks/${file.name}`);
      }
    }
    
    // Also try to remove the source.zip if it exists
    filesToRemove.push(`${folderPath}/source.zip`);

    if (filesToRemove.length > 0) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(filesToRemove);
      if (removeError) {
        console.error('Remove error:', removeError);
      }
    }

    return new Response(JSON.stringify({ success: true, removedCount: filesToRemove.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
