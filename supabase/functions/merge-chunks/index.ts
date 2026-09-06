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
    const { repoId, commitHash, totalChunks } = await req.json();

    if (!repoId || !commitHash || !totalChunks) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: repoId, commitHash, totalChunks' }), {
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

    // Download and concatenate all chunks
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = `${repoId}/${commitHash}/chunks/part-${i}`;
      const { data, error } = await supabase.storage.from(BUCKET).download(chunkPath);

      if (error || !data) {
        throw new Error(`Failed to download chunk ${i}: ${error?.message ?? 'No data'}`);
      }

      const bytes = new Uint8Array(await data.arrayBuffer());
      chunks.push(bytes);
      totalLength += bytes.length;
    }

    // Merge chunks into single buffer
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Upload final source.zip
    const finalPath = `${repoId}/${commitHash}/source.zip`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(finalPath, merged, { contentType: 'application/zip', upsert: true });

    if (uploadError) {
      throw new Error(`Failed to upload merged zip: ${uploadError.message}`);
    }

    // Cleanup chunk files
    const chunkPaths = Array.from({ length: totalChunks }, (_, i) => `${repoId}/${commitHash}/chunks/part-${i}`);
    await supabase.storage.from(BUCKET).remove(chunkPaths);

    return new Response(JSON.stringify({ success: true, path: finalPath, commitHash }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('merge-chunks error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
