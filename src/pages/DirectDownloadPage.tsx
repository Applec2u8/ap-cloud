import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

/**
 * DirectDownloadPage — /dl/:version
 *
 * Special keywords:
 *   /dl/latest  → downloads the release where is_latest = true
 *   /dl/1.2.3   → downloads the specific version
 *
 * Fetches the public_url from the releases table and immediately redirects
 * the browser to it, triggering a native file download.
 * This URL is safe to use in version.json for auto-updaters.
 */
const DirectDownloadPage: React.FC = () => {
  const { version } = useParams<{ version: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!version) return;
    (async () => {
      let query = supabase
        .from('releases')
        .select('public_url, version')
        .eq('is_public', true);

      // Support the special "latest" keyword
      if (version === 'latest') {
        query = query.eq('is_latest', true);
      } else {
        query = query.eq('version', version);
      }

      const { data, error } = await query.single();

      if (error || !data?.public_url) {
        navigate('/404', { replace: true });
        return;
      }

      // Redirect immediately — browser will trigger native download
      window.location.href = data.public_url;
    })();
  }, [version, navigate]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        minHeight: '100vh',
        background: 'hsl(var(--background, 222 84% 2%))',
        color: 'hsl(var(--foreground, 210 40% 98%))',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <span className="spinner" style={{ width: 48, height: 48 }} />
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Starting download…</h2>
      <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9rem' }}>
        {version === 'latest'
          ? 'Resolving latest release — you will be redirected momentarily.'
          : `Resolving v${version} — you will be redirected momentarily.`}
      </p>
    </div>
  );
};

export default DirectDownloadPage;
