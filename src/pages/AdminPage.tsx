import React, { useState, useCallback, useEffect } from 'react';
import { supabase, supabaseUrl } from '../supabaseClient';
import type { Release } from '../supabaseClient';
import DropZone from '../components/DropZone';
import ProgressBar from '../components/ProgressBar';
import ReleaseCard from '../components/ReleaseCard';
import ThemeSwitcher from '../components/ThemeSwitcher';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string;

// ─── Auth Gate ────────────────────────────────────────────────────────────────
const AuthGate: React.FC<{ onAuth: () => void }> = ({ onAuth }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('ap_cloud_auth', '1');
      onAuth();
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <div className="auth-card__logo">
          <div className="auth-card__icon">🔐</div>
          <h1 className="auth-card__title">Admin Access</h1>
          <p className="auth-card__subtitle">AP-Cloud — Restricted Area</p>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              className="form-input"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn--primary w-full" id="admin-login-btn">
            🔓 Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Admin Panel ──────────────────────────────────────────────────────────────
const AdminPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [appName, setAppName] = useState('');
  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isLatest, setIsLatest] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(true);
  const [updatingVisibilityId, setUpdatingVisibilityId] = useState<string | null>(null);
  const [updatingLatestId, setUpdatingLatestId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const baseUrl = window.location.origin;

  const showAlert = (type: 'success' | 'error', msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  };

  const fetchReleases = useCallback(async () => {
    setLoadingReleases(true);
    const { data, error } = await supabase
      .from('releases')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setReleases(data as Release[]);
    setLoadingReleases(false);
  }, []);

  const uploadWithProgress = (path: string, uploadFile: File, onProgress: (value: number) => void) => {
    const attempt = (retryCount: number): Promise<void> => new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `${supabaseUrl}/storage/v1/object/updates/${path}`);
      request.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
      request.setRequestHeader('Authorization', `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`);
      request.setRequestHeader('x-upsert', 'false');
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 70));
      };
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) resolve();
        else reject(new Error(request.responseText || `Storage upload failed (${request.status})`));
      };
      request.onerror = () => {
        if (retryCount < 3) window.setTimeout(() => { void attempt(retryCount + 1).then(resolve).catch(reject); }, 1000 * (retryCount + 1));
        else reject(new Error('Network connection lost. Upload could not be completed after 3 retries.'));
      };
      request.send(uploadFile);
    });
    return attempt(0);
  };

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !appName.trim() || !version.trim()) {
      showAlert('error', 'Please fill all fields and select a file.');
      return;
    }

    // Validate version uniqueness
    const existing = releases.find((r) => r.version === version.trim());
    if (existing) {
      showAlert('error', `Version v${version.trim()} already exists. Use a different version number.`);
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const safeName = file.name.replace(/\s+/g, '_');
      const storagePath = `${version.trim()}/${safeName}`;

      // Upload to Supabase Storage
      await uploadWithProgress(storagePath, file, (uploadProgress) => setProgress(10 + uploadProgress));
      setProgress(65);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('updates')
        .getPublicUrl(storagePath);

      setProgress(80);

      // Insert into releases table
      const { data: insertedRelease, error: dbError } = await supabase.from('releases').insert({
        app_name: appName.trim(),
        version: version.trim(),
        filename: safeName,
        size: file.size,
        public_url: urlData.publicUrl,
        release_notes: releaseNotes.trim() || null,
        is_public: isPublic,
        is_latest: false,
      }).select('id').single();

      if (dbError) throw dbError;
      if (isLatest) {
        const { error: latestError } = await supabase.rpc('set_latest_release', { target_release_id: insertedRelease.id });
        if (latestError) throw latestError;
      }

      setProgress(100);
      showAlert('success', `✅ v${version.trim()} uploaded successfully!`);

      // Reset form
      setFile(null);
      setAppName('');
      setVersion('');
      setReleaseNotes('');
      setIsPublic(true);
      setIsLatest(false);
      setTimeout(() => setProgress(0), 800);

      fetchReleases();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      showAlert('error', message);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleLatestChange = async (release: Release) => {
    if (release.is_latest) return;
    setUpdatingLatestId(release.id);
    try {
      const { error } = await supabase.rpc('set_latest_release', { target_release_id: release.id });
      if (error) throw new Error(`Could not set latest version: ${error.message}`);
      await fetchReleases();
      showAlert('success', `Release v${release.version} is now the Latest Version.`);
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'Could not set latest version.');
    } finally {
      setUpdatingLatestId(null);
    }
  };

  const handleVisibilityChange = async (release: Release) => {
    const nextVisibility = !release.is_public;
    setUpdatingVisibilityId(release.id);

    try {
      const { data, error } = await supabase
        .from('releases')
        .update({ is_public: nextVisibility })
        .eq('id', release.id)
        .select('id, is_public')
        .maybeSingle();

      if (error) throw new Error(`Could not save visibility: ${error.message}`);
      if (!data) {
        throw new Error('Could not save visibility: no row was updated. Check the Supabase UPDATE/RLS policy for releases.');
      }
      if (data.is_public !== nextVisibility) {
        throw new Error('Supabase returned an unexpected visibility value. The database schema may be out of date.');
      }

      await fetchReleases();
      showAlert('success', `Release v${release.version} is now ${nextVisibility ? 'Public' : 'Private'}.`);
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'Could not save release visibility.');
    } finally {
      setUpdatingVisibilityId(null);
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    // Find the release to get its version
    const release = releases.find((r) => r.id === id);
    if (!release) return;

    // Delete from storage
    const storagePath = `${release.version}/${filename}`;
    await supabase.storage.from('updates').remove([storagePath]);

    // Delete from DB
    await supabase.from('releases').delete().eq('id', id);

    setReleases((prev) => prev.filter((r) => r.id !== id));
    showAlert('success', 'Release deleted.');
  };

  const handleSignOut = () => {
    sessionStorage.removeItem('ap_cloud_auth');
    window.location.reload();
  };

  return (
    <div className="page-wrapper">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar__inner">
          <a href="/" className="navbar__brand">
            <div className="navbar__brand-icon">☁️</div>
            AP-Cloud
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ThemeSwitcher />
            <span className="badge badge--purple">Admin</span>
            <button className="btn btn--secondary btn--sm" onClick={handleSignOut} id="signout-btn">
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="admin-main">
        <div className="container container--wide">
          {/* Page title */}
          <div style={{ marginBottom: 32 }}>
            <h1 className="heading-lg" style={{ marginBottom: 6 }}>Release Manager</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Upload and manage installer releases distributed to users.</p>
          </div>

          {alert && (
            <div className={`alert alert--${alert.type}`} role="alert">
              {alert.msg}
            </div>
          )}

          <div className="admin-layout">
            {/* ── Upload Form ── */}
            <div>
              <div className="admin-section-title">Upload New Release</div>
              <div className="card card--glass">
                <form onSubmit={handleUpload}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="app-name">App Name</label>
                    <input
                      id="app-name"
                      type="text"
                      className="form-input"
                      placeholder="e.g. MyApp Desktop"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      disabled={uploading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="version">Version</label>
                    <input
                      id="version"
                      type="text"
                      className="form-input"
                      placeholder="e.g. 1.0.0"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      disabled={uploading}
                    />
                    <span className="form-hint">Used in download URLs: /download/1.0.0</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="release-notes">Release Notes (optional)</label>
                    <textarea
                      id="release-notes"
                      className="form-input"
                      placeholder="What's new in this version..."
                      value={releaseNotes}
                      onChange={(e) => setReleaseNotes(e.target.value)}
                      disabled={uploading}
                      rows={3}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="visibility-toggle"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} disabled={uploading} /><span><strong>Make this release public</strong><small>Public releases appear on the home page and can be downloaded without login.</small></span></label>
                  </div>

                  <div className="form-group">
                    <label className="visibility-toggle"><input type="checkbox" checked={isLatest} onChange={(event) => setIsLatest(event.target.checked)} disabled={uploading} /><span><strong>Set as Latest Version</strong><small>This automatically removes Latest from the previous release.</small></span></label>
                  </div>

                  <div className="form-group">
                    <label className="form-label">File</label>
                    <DropZone onFileSelected={setFile} disabled={uploading} />
                  </div>

                  {uploading && <ProgressBar progress={progress} label="Uploading to Supabase..." />}

                  <button
                    type="submit"
                    className="btn btn--primary w-full"
                    disabled={uploading || !file || !appName || !version}
                    id="upload-btn"
                    style={{ marginTop: 8 }}
                  >
                    {uploading ? (
                      <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Uploading...</>
                    ) : (
                      <>☁️ Upload Release</>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* ── Release List ── */}
            <div>
              <div className="admin-section-title">
                All Releases
                <span className="badge badge--blue" style={{ marginLeft: 4 }}>{releases.length}</span>
              </div>

              {loadingReleases ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                  <div>Loading releases...</div>
                </div>
              ) : releases.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">📭</div>
                  <div className="empty-state__title">No releases yet</div>
                  <p>Upload your first release using the form.</p>
                </div>
              ) : (
                <div className="release-list">
                  {releases.map((r) => (
                    <ReleaseCard
                      key={r.id}
                      release={r}
                      onDelete={handleDelete}
                      onVisibilityChange={handleVisibilityChange}
                      visibilityUpdating={updatingVisibilityId === r.id}
                      onLatestChange={handleLatestChange}
                      latestUpdating={updatingLatestId === r.id}
                      baseUrl={baseUrl}
                    />
                  ))}
                </div>
              )}

              {/* version.json helper */}
              {releases.length > 0 && (
                <div className="card" style={{ marginTop: 20 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                    🤖 Auto-Updater · version.json example
                  </div>
                  <pre style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    fontSize: '0.78rem',
                    color: 'var(--accent-cyan)',
                    overflowX: 'auto',
                    lineHeight: 1.7,
                  }}>
{`{
  "version": "${releases[0].version}",
  "url": "${baseUrl}/dl/${releases[0].version}"
}`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">AP-Cloud Admin · Powered by Supabase</footer>
    </div>
  );
};

// ─── Main Export ──────────────────────────────────────────────────────────────
const AdminPage: React.FC = () => {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('ap_cloud_auth') === '1');

  if (!authed) return <AuthGate onAuth={() => setAuthed(true)} />;
  return <AdminPanel />;
};

export default AdminPage;
