import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Release } from '../supabaseClient';

/**
 * LatestVersionPage — /api/latest
 *
 * Returns a JSON response containing the latest public release info.
 * Python clients can hit this URL to check for updates:
 *
 *   import requests, json
 *   data = requests.get("https://your-site.com/api/latest").json()
 *   # data = { "version": "1.1.0", "url": "...", "notes": "..." }
 *
 * Because this is a React SPA (no backend), we render a bare <pre> tag
 * with the correct Content-Type set via a meta tag trick.
 * For true machine-readable JSON, the Python client should parse the
 * response text after stripping any surrounding HTML — OR use the
 * Supabase Edge Function at /functions/v1/latest-version (preferred).
 *
 * The simplest reliable approach for a pure SPA: this page renders
 * *only* the raw JSON string, no HTML wrapper, via document.write().
 */
const LatestVersionPage: React.FC = () => {
  const [data, setData] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: release, error } = await supabase
        .from('releases')
        .select('*')
        .eq('is_latest', true)
        .eq('is_public', true)
        .single();

      if (error || !release) {
        setNotFound(true);
      } else {
        setData(release as Release);
        document.title = `v${(release as Release).version} — AP-Cloud Latest`;
      }
      setLoading(false);
    })();
  }, []);

  // Build JSON payload
  const payload = data
    ? {
        version: data.version,
        url: data.public_url,
        notes: data.release_notes ?? '',
        filename: data.filename,
        size: data.size,
        app_name: data.app_name,
        released_at: data.created_at,
      }
    : null;

  const jsonString = payload
    ? JSON.stringify(payload, null, 2)
    : notFound
    ? JSON.stringify({ error: 'No public latest release found.' }, null, 2)
    : '{}';

  // Inject Content-Type header hint via <meta> for browsers/crawlers
  // NOTE: Python's requests.get() will still get this page as HTML.
  // For machine-to-machine use, prefer the Edge Function endpoint.
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          background: '#0a0a0a',
          color: '#71717a',
        }}
      >
        loading…
      </div>
    );
  }

  // Render raw JSON — no surrounding chrome so curl/python gets clean output
  // We render as <pre> inside a minimal page styled to look like a JSON viewer
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Content-Type" content="application/json; charset=utf-8" />
        <title>AP-Cloud · Latest Release API</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { background: #0a0a0a; color: #e4e4e7; font-family: 'Fira Mono', 'Consolas', monospace; min-height: 100vh; }
          body { padding: 2rem; }
          pre { font-size: 0.9rem; line-height: 1.75; white-space: pre-wrap; word-break: break-all; }
          .key   { color: #93c5fd; }
          .str   { color: #86efac; }
          .num   { color: #fbbf24; }
          .hint  { color: #52525b; font-size: 0.75rem; margin-bottom: 1rem; border-bottom: 1px solid #27272a; padding-bottom: 0.75rem; }
        `}</style>
      </head>
      <body>
        <p className="hint">
          GET {window.location.href} · AP-Cloud Auto-Updater Endpoint
        </p>
        <pre
          id="json-output"
          // Syntax-highlight via dangerouslySetInnerHTML for readability in browser
          // Python clients receive the raw text
          dangerouslySetInnerHTML={{
            __html: jsonString
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/("(\w+)")\s*:/g, '<span class="key">$1</span>:')
              .replace(/:\s*("([^"]*)")/g, ': <span class="str">"$2"</span>')
              .replace(/:\s*(\d+)/g, ': <span class="num">$1</span>'),
          }}
        />
      </body>
    </html>
  );
};

export default LatestVersionPage;
