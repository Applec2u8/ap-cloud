import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { Release } from '../supabaseClient';
import ThemeSwitcher from '../components/ThemeSwitcher';

const formatSize = (bytes: number) => {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const getFileIcon = (filename?: string) => {
  const ext = filename?.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'exe': return '⚙️';
    case 'msi': return '🔧';
    case 'zip': return '🗜️';
    case 'pkg': return '📦';
    case 'dmg': return '💿';
    default: return '💾';
  }
};

const DownloadPage: React.FC = () => {
  const { version } = useParams<{ version: string }>();
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!version) return;
    (async () => {
      const { data, error } = await supabase
        .from('releases')
        .select('*')
        .eq('version', version)
        .eq('is_public', true)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setRelease(data as Release);
        document.title = `Download ${(data as Release).app_name} v${version} — AP-Cloud`;
      }
      setLoading(false);
    })();
  }, [version]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" style={{ width: 40, height: 40 }} />
        <p>Loading release info...</p>
      </div>
    );
  }

  if (notFound || !release) {
    return (
      <div className="page-wrapper">
        <nav className="navbar">
          <div className="navbar__inner">
            <Link to="/" className="navbar__brand">
              <div className="navbar__brand-icon">☁️</div>
              AP-Cloud
            </Link>
          </div>
        </nav>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: 16 }}>🔍</div>
            <h1 className="heading-lg" style={{ marginBottom: 8 }}>Release Not Found</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              Version <strong>v{version}</strong> does not exist or has been removed.
            </p>
            <Link to="/" className="btn btn--secondary">← Go Home</Link>
          </div>
        </div>
      </div>
    );
  }

  const directDownloadUrl = `${window.location.origin}/dl/${release.version}`;

  return (
    <div className="page-wrapper">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar__inner">
          <Link to="/" className="navbar__brand">
            <div className="navbar__brand-icon">☁️</div>
            AP-Cloud
          </Link>
          <div className="download-header-actions"><ThemeSwitcher /><span className="badge badge--green">✓ Verified Release</span></div>
        </div>
      </nav>

      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <div className="dl-hero">
          <div className="dl-app-icon" role="img" aria-label="App icon">
            {getFileIcon(release.filename)}
          </div>
          <h1 className="heading-xl" style={{ marginBottom: 12 }}>
            {release.app_name}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: 24 }}>
            The latest official release, securely hosted and ready to download.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <span className="badge badge--blue">v{release.version}</span>
            <span className="badge badge--purple">{release.filename.split('.').pop()?.toUpperCase()}</span>
          </div>
        </div>

        <div className="container" style={{ paddingBottom: 64 }}>
          {/* Info Grid */}
          <div className="dl-info-grid">
            <div className="dl-info-item">
              <div className="dl-info-item__icon">🏷️</div>
              <div className="dl-info-item__label">Version</div>
              <div className="dl-info-item__value">v{release.version}</div>
            </div>
            <div className="dl-info-item">
              <div className="dl-info-item__icon">💾</div>
              <div className="dl-info-item__label">File Size</div>
              <div className="dl-info-item__value">{formatSize(release.size)}</div>
            </div>
            <div className="dl-info-item">
              <div className="dl-info-item__icon">📅</div>
              <div className="dl-info-item__label">Release Date</div>
              <div className="dl-info-item__value" style={{ fontSize: '0.85rem' }}>{formatDate(release.created_at)}</div>
            </div>
            <div className="dl-info-item">
              <div className="dl-info-item__icon">📄</div>
              <div className="dl-info-item__label">Filename</div>
              <div className="dl-info-item__value" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                {release.filename}
              </div>
            </div>
          </div>

          {/* Download Button */}
          <div style={{ textAlign: 'center', margin: '40px 0' }}>
            <a
              href={release.public_url}
              download
              className="dl-download-btn"
              id="download-now-btn"
              rel="noreferrer"
            >
              <span className="dl-download-btn__icon">⬇</span>
              Download Now
              <span style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 400 }}>
                · {formatSize(release.size)}
              </span>
            </a>
            <p style={{ marginTop: 14, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              🔒 File served directly from Supabase Storage — no login required
            </p>
          </div>

          {/* Release Notes */}
          {release.release_notes && (
            <div className="dl-release-notes">
              <h3>📋 Release Notes</h3>
              <p>{release.release_notes}</p>
            </div>
          )}

          {/* Direct Download URL */}
          <div className="card" style={{ marginTop: 24, textAlign: 'center' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10 }}>
              🤖 Use this URL in <code style={{ color: 'var(--accent-cyan)', background: 'rgba(34,211,238,0.08)', padding: '2px 6px', borderRadius: 4 }}>version.json</code> for auto-updates
            </p>
            <div className="copy-field" style={{ justifyContent: 'center' }}>
              <span className="copy-field__text">{directDownloadUrl}</span>
              <button
                className="copy-field__btn"
                id="copy-direct-url-btn"
                onClick={async () => {
                  await navigator.clipboard.writeText(directDownloadUrl);
                }}
              >
                📋 Copy
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        AP-Cloud · <a href="/admin" style={{ color: 'var(--text-muted)' }}>Admin</a> · Powered by Supabase
      </footer>
    </div>
  );
};

export default DownloadPage;
