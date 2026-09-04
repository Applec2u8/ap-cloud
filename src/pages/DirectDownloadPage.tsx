import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

/**
 * DirectDownloadPage — /dl/:version
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
      const { data, error } = await supabase
        .from('releases')
        .select('public_url')
        .eq('version', version)
        .eq('is_public', true)
        .single();

      if (error || !data?.public_url) {
        navigate('/404', { replace: true });
        return;
      }

      // Redirect immediately — browser will trigger native download
      window.location.href = data.public_url;
    })();
  }, [version, navigate]);

  return (
    <div className="loading-screen">
      <div className="spinner" style={{ width: 48, height: 48 }} />
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Starting download...</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Resolving v{version} — you will be redirected momentarily.
      </p>
    </div>
  );
};

export default DirectDownloadPage;
