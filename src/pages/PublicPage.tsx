import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { Release } from '../supabaseClient';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { Search, Cloud, LayoutGrid, Info, ArrowUpRight, Package, Users2, Globe, MessageCircle, Share2, Download, Check, Star } from 'lucide-react';

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

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'exe': return '⚙️';
    case 'msi': return '🔧';
    case 'zip': return '🗜️';
    case 'pkg': return '📦';
    case 'dmg': return '💿';
    default: return '📄';
  }
};

const PublicPage: React.FC = () => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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

  // Close bottom sheet on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContactOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
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

          {/* ── Desktop table header — hidden on mobile ── */}
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-x-4 border-b border-border pb-2.5 pl-4 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Application</span>
            <span>Version</span>
            <span>File size</span>
            <span>Date</span>
            <span className="text-right">Actions</span>
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
            <div className="flex flex-col gap-3 sm:gap-0">
              {filteredReleases.map((release) => {
                const shareUrl = `${window.location.origin}/download/${release.version}`;
                const downloadUrl = release.public_url || `${window.location.origin}/download/${release.version}`;

                return (
                  <div key={release.id}>

                    {/* ════════════════════════════════════════
                        MOBILE card (< sm)
                    ════════════════════════════════════════ */}
                    <div className="sm:hidden rounded-xl border border-border bg-card mx-0 p-4 transition hover:border-blue-300/60 hover:bg-accent/30">
                      {/* Card header: clickable area → navigate to detail page */}
                      <Link
                        to={`/download/${release.version}`}
                        className="flex items-center gap-3 mb-3 no-underline"
                      >
                        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-blue-50 text-2xl border border-blue-100/60 dark:bg-blue-950/40 dark:border-blue-900/30">
                          {getFileIcon(release.filename)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-foreground text-base leading-tight truncate">
                              {release.app_name}
                            </span>
                            {release.is_latest && (
                              <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                Latest
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                            {release.filename}
                          </p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-blue-500/60" />
                      </Link>

                      {/* Labeled info rows */}
                      <Link to={`/download/${release.version}`}>
                        <div className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-3 text-sm">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide self-center">Version</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">v{release.version}</span>

                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide self-center">Size</span>
                          <span className="text-foreground">{formatSize(release.size)}</span>

                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide self-center">Date</span>
                          <span className="text-foreground">{formatDate(release.created_at)}</span>
                        </div>
                      </Link>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(shareUrl, `share-${release.id}`);
                          }}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          title="Copy Share URL"
                        >
                          {copiedId === `share-${release.id}` ? (
                            <><Check className="h-4 w-4 text-emerald-500" /><span className="text-emerald-600 font-medium">Copied!</span></>
                          ) : (
                            <><Share2 className="h-4 w-4" /><span>Share</span></>
                          )}
                        </button>
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                          title="Download File"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      </div>
                    </div>

                    {/* ════════════════════════════════════════
                        DESKTOP table row (sm+)
                    ════════════════════════════════════════ */}
                    <Link
                      to={`/download/${release.version}`}
                      className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-x-4 border-b border-border px-4 py-3 text-sm text-muted-foreground no-underline transition hover:bg-accent cursor-pointer"
                    >
                      {/* App name + filename */}
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-blue-50 text-xl border border-blue-100/50 dark:bg-blue-950/40 dark:border-blue-900/30">
                          {getFileIcon(release.filename)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-foreground">{release.app_name}</span>
                            {release.is_latest && (
                              <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                Latest
                              </span>
                            )}
                          </div>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">{release.filename}</p>
                        </div>
                      </div>

                      <span className="font-semibold text-blue-600 dark:text-blue-400">v{release.version}</span>
                      <span>{formatSize(release.size)}</span>
                      <span className="text-xs">{formatDate(release.created_at)}</span>

                      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copyToClipboard(shareUrl, `share-${release.id}`);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          title="Copy Share URL"
                        >
                          {copiedId === `share-${release.id}` ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Share2 className="h-4 w-4" />
                          )}
                        </button>
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white transition hover:bg-blue-700"
                          title="Download File"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    </Link>

                  </div>
                );
              })}
            </div>
          )}

          {/* ── Footer ── */}
          <footer className="mt-10 flex flex-col items-center gap-4 border-t border-border pt-8 pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="grid h-5 w-5 place-items-center rounded bg-blue-600 text-[10px] font-bold text-white">A</span>
              <span className="font-semibold text-foreground">AP-Cloud</span>
              <span className="text-muted-foreground/40">·</span>
              <span>Official public library</span>
            </div>
            <button
              id="open-contact-sheet"
              onClick={() => setContactOpen(true)}
              className="group flex items-center gap-2.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
            >
              <MessageCircle className="h-4 w-4 text-blue-600 transition group-hover:scale-110" />
              ຊ່ອງທາງຕຶດຕໍ່
            </button>
            <p className="text-[11px] text-muted-foreground/60">
              © {new Date().getFullYear()} AP-Cloud · Only public releases appear here
            </p>
          </footer>
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
            <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
              Only releases marked public by an administrator appear here.
            </p>

            <div className="flex flex-col gap-3 mt-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Connect</p>
              <a href="https://web.facebook.com/kkop.gonc/?checkpoint_src=any" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-muted-foreground transition hover:text-blue-600 dark:hover:text-blue-400">
                <Users2 className="h-4 w-4" />
                <span>Facebook</span>
              </a>
              <a href="https://wa.me/+8562095188702" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-muted-foreground transition hover:text-green-600 dark:hover:text-green-400">
                <MessageCircle className="h-4 w-4" />
                <span>WhatsApp</span>
              </a>
              <a href="https://lagame.pages.dev" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-muted-foreground transition hover:text-foreground">
                <Globe className="h-4 w-4" />
                <span>Official Website</span>
              </a>
            </div>
          </div>
        </aside>
      </div>

      {/* ══════════════════════════════════════
          Contact Bottom Sheet
      ══════════════════════════════════════ */}

      {/* Backdrop */}
      <div
        onClick={() => setContactOpen(false)}
        aria-hidden="true"
        style={{
          opacity: contactOpen ? 1 : 0,
          pointerEvents: contactOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
      />

      {/* Sheet panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ช่องทางติดต่อ"
        style={{
          transform: contactOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
          maxHeight: '90dvh',
          overflowY: 'auto',
        }}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-border bg-card shadow-2xl"
      >
        {/* Drag handle */}
        <div className="sticky top-0 flex justify-center bg-card pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
        </div>

        <div className="px-6 pb-12 pt-2 sm:px-10">
          {/* Sheet header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">ຊ່ອງທາງຕຶດຕໍ່</h2>
              <p className="mt-1 text-sm text-muted-foreground">ເລືອກຊ່ອງທາງທີ່ສະດວກສຳລັບທ່ານ</p>
            </div>
            <button
              onClick={() => setContactOpen(false)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Close contact sheet"
            >
              ✕
            </button>
          </div>

          {/* Contact cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Facebook */}
            <a
              href="https://web.facebook.com/kkop.gonc/?checkpoint_src=any"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-4 rounded-2xl border border-border bg-background p-5 no-underline transition hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30 transition group-hover:scale-105">
                <Users2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Facebook</p>
                <p className="text-xs text-muted-foreground">ແຊັດຫາທີມງານໂດຍຕົງ</p>
              </div>
              <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/40 transition group-hover:text-blue-600" />
            </a>

            {/* WhatsApp */}
            <a
              href="https://wa.me/+8562095188702"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-4 rounded-2xl border border-border bg-background p-5 no-underline transition hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-green-500 text-white shadow-md shadow-green-500/30 transition group-hover:scale-105">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">WhatsApp</p>
                <p className="text-xs text-muted-foreground">ແຊັດຫາທີມງານໂດຍຕົງ</p>
              </div>
              <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/40 transition group-hover:text-green-600" />
            </a>

            {/* Website */}
            <a
              href="https://lagame.pages.dev/"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-4 rounded-2xl border border-border bg-background p-5 no-underline transition hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 text-white shadow-md shadow-purple-500/30 transition group-hover:scale-105">
                <Globe className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">LA-GAME</p>
                <p className="text-xs text-muted-foreground">ເວັບແຈກເກມຟີ</p>
              </div>
              <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/40 transition group-hover:text-purple-600" />
            </a>
          </div>

          {/* Footer note */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            ກຳກັບຜູ້ດຽວໂດຍ Apple.2u8 by AP-Cloud
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublicPage;