import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { Release } from '../supabaseClient';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { Search, Cloud, LayoutGrid, Info, ArrowUpRight, Package } from 'lucide-react';

const formatSize = (bytes: number) => {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const getFileIcon = (filename: string) =>
  filename.toLowerCase().endsWith('.exe') ? '⚙️' : '📄';

const PublicPage: React.FC = () => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.title = 'Public releases — AP-Cloud';
    supabase
      .from('releases')
      .select('*')
      .eq('is_public', true)
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ── Header ── */}
      <header className="flex h-[72px] items-center gap-3 border-b border-border/50 bg-background/95 px-4 backdrop-blur-lg dark:border-white/10 dark:bg-black/20 sm:gap-6 sm:px-7 shadow-sm">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 text-[1.1rem] font-semibold text-foreground no-underline"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            A
          </span>
          <span className="hidden sm:inline">AP-Cloud</span>
        </Link>

        {/* Search */}
        <label className="flex flex-1 min-w-0 items-center gap-2 rounded-xl bg-muted px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5 max-w-[640px] cursor-text">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            aria-label="Search releases"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">⌘ K</span>
        </label>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeSwitcher />
          <span className="hidden h-8 w-8 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 sm:grid">
            AP
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_240px]">

        {/* ── Sidebar ── */}
        <aside className="hidden border-r border-border/50 bg-background/95 backdrop-blur-md dark:border-white/10 dark:bg-black/20 md:flex md:flex-col md:px-4 md:py-6">
          <Link
            to="/"
            className="flex w-fit items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground shadow-sm no-underline transition hover:bg-accent"
          >
            <span className="text-lg text-blue-600">＋</span>
            Newest releases
          </Link>

          <nav className="mt-6 flex flex-col gap-1">
            <a
              href="#releases"
              className="flex items-center gap-3 rounded-r-2xl bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
            >
              <LayoutGrid className="h-4 w-4" />
              All releases
            </a>
            <a
              href="#about"
              className="flex items-center gap-3 rounded-r-2xl px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <Info className="h-4 w-4" />
              About AP-Cloud
            </a>
          </nav>

          <div className="mt-auto flex items-center gap-3 border-t border-border pt-5 text-sm text-muted-foreground">
            <Cloud className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-semibold text-foreground">Public library</p>
              <p className="text-xs">
                {releases.length} available release{releases.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </aside>

        {/* ── Main Table ── */}
        <main className="min-w-0 p-6 sm:p-9" id="releases">
          {/* Toolbar */}
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600">
                Public library
              </p>
              <h1 className="text-2xl font-medium tracking-tight text-foreground">All releases</h1>
            </div>
            <span className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
              Last modified ▾
            </span>
          </div>

          {/* Table header */}
          <div className="hidden grid-cols-[minmax(200px,2fr)_1fr_1fr_1.1fr_28px] gap-4 border-b border-border pb-2.5 pl-4 pr-4 text-xs text-muted-foreground sm:grid">
            <span>Name</span>
            <span>Version</span>
            <span>File size</span>
            <span>Last modified</span>
            <span />
          </div>

          {/* Rows */}
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
              <span className="spinner" style={{ width: 32, height: 32 }} />
              <span className="text-sm">Loading releases…</span>
            </div>
          ) : filteredReleases.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20 text-center">
              <Package className="h-10 w-10 text-muted-foreground/40" />
              <p className="font-semibold text-foreground">No public releases found</p>
              <p className="text-sm text-muted-foreground">Try a different search or check back later.</p>
            </div>
          ) : (
            <div>
              {filteredReleases.map((release) => (
                <Link
                  to={`/download/${release.version}`}
                  key={release.id}
                  className="grid min-h-[68px] grid-cols-[minmax(0,1fr)_auto_28px] items-center gap-3 border-b border-border px-4 py-3 text-sm text-muted-foreground no-underline transition hover:bg-accent sm:grid-cols-[minmax(200px,2fr)_1fr_1fr_1.1fr_28px] sm:gap-4"
                >
                  {/* File name + icon */}
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-blue-50 text-base dark:bg-blue-950/40">
                      {getFileIcon(release.filename)}
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate font-semibold text-foreground">
                        {release.app_name}
                      </strong>
                      <small className="block truncate text-xs text-muted-foreground">
                        {release.filename}
                      </small>
                    </span>
                  </span>

                  <span className="hidden sm:block">v{release.version}</span>
                  <span className="hidden sm:block">{formatSize(release.size)}</span>
                  <span className="hidden text-xs sm:block">{formatDate(release.created_at)}</span>
                  <ArrowUpRight className="h-4 w-4 text-blue-600" />
                </Link>
              ))}
            </div>
          )}
        </main>

        {/* ── Detail Panel ── */}
        <aside
          className="hidden border-l border-border/50 bg-background/95 backdrop-blur-md dark:border-white/10 dark:bg-black/20 xl:block"
          id="about"
        >
          <div className="p-6">
            <p className="text-sm font-semibold text-muted-foreground">About this library</p>
            <div className="my-8 grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)]">
              A
            </div>
            <h2 className="text-center text-lg font-semibold text-foreground">AP-Cloud</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Official application releases, available for direct download.
            </p>
            <hr className="my-6 border-border" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Only releases marked public by an administrator appear here.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PublicPage;