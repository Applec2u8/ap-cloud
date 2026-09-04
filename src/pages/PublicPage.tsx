import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { Release } from '../supabaseClient';
import ThemeSwitcher from '../components/ThemeSwitcher';

const formatSize = (bytes: number) => {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', {
  year: 'numeric', month: 'short', day: 'numeric',
});

const PublicPage: React.FC = () => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.title = 'Public releases - AP-Cloud';
    supabase.from('releases').select('*').eq('is_public', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setReleases(data as Release[]);
        setLoading(false);
      });
  }, []);

  const filteredReleases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return releases;
    return releases.filter((release) =>
      `${release.app_name} ${release.version} ${release.filename}`.toLowerCase().includes(normalizedQuery)
    );
  }, [query, releases]);

  return (
    <div className="drive-shell">
      <header className="drive-header">
        <Link to="/" className="drive-brand"><span className="drive-brand__mark">A</span><span>AP-Cloud</span></Link>
        <label className="drive-search"><span>⌕</span><input aria-label="Search releases" placeholder="Search in releases" value={query} onChange={(event) => setQuery(event.target.value)} /><span>⌘ K</span></label>
        <div className="drive-header__actions"><ThemeSwitcher /><span className="drive-avatar">AP</span></div>
      </header>
      <div className="drive-body">
        <aside className="drive-sidebar">
          <Link className="drive-new-button" to="/"><span>＋</span> Newest releases</Link>
          <nav className="drive-nav"><a className="drive-nav__item drive-nav__item--active" href="#releases"><span>▦</span> All releases</a><a className="drive-nav__item" href="#about"><span>ⓘ</span> About AP-Cloud</a></nav>
          <div className="drive-sidebar__foot"><span className="drive-storage__icon">☁</span><div><strong>Public library</strong><small>{releases.length} available release{releases.length === 1 ? '' : 's'}</small></div></div>
        </aside>
        <main className="drive-main" id="releases">
          <div className="drive-toolbar"><div><p className="eyebrow">Public library</p><h1>All releases</h1></div><span className="drive-sort">Last modified ▾</span></div>
          <div className="drive-table__head"><span>Name</span><span>Version</span><span>File size</span><span>Last modified</span></div>
          {loading ? <div className="drive-empty">Loading releases...</div> : filteredReleases.length === 0 ? <div className="drive-empty"><strong>No public releases found</strong><span>Try a different search or check back later.</span></div> : (
            <div className="drive-table">{filteredReleases.map((release) => <Link to={`/download/${release.version}`} className="drive-row" key={release.id}>
              <span className="drive-file"><span className="drive-file__icon">{release.filename.toLowerCase().endsWith('.exe') ? '⚙' : '▤'}</span><span><strong>{release.app_name}</strong><small>{release.filename}</small></span></span><span>v{release.version}</span><span>{formatSize(release.size)}</span><span>{formatDate(release.created_at)}</span><span className="drive-row__action">↗</span>
            </Link>)}</div>
          )}
        </main>
        <aside className="drive-details" id="about"><div className="drive-details__title">About this library</div><div className="drive-details__icon">A</div><h2>AP-Cloud</h2><p>Official application releases, available for direct download.</p><div className="drive-details__rule" /><small>Only releases marked public by an administrator appear here.</small></aside>
      </div>
    </div>
  );
};

export default PublicPage;