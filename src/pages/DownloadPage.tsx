import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { Release } from '../supabaseClient';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Copy, Check, ShieldCheck, Tag, HardDrive, Calendar, FileText, ArrowLeft } from 'lucide-react';

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
  const [copied, setCopied] = useState(false);

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
        <span className="spinner" style={{ width: 40, height: 40 }} />
        <p className="text-sm">Loading release info…</p>
      </div>
    );
  }

  if (notFound || !release) {
    return (
      <div className="flex min-h-screen flex-col">
        <nav className="sticky top-0 z-50 border-b border-white/20 bg-white/5 backdrop-blur-lg dark:border-white/10 dark:bg-black/20 shadow-sm">
          <div className="mx-auto flex h-16 max-w-5xl items-center px-6">
            <Link to="/" className="flex items-center gap-2.5 font-bold text-foreground no-underline">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-sm">
                ☁️
              </div>
              AP-Cloud
            </Link>
          </div>
        </nav>
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="text-center">
            <div className="mb-4 text-7xl">🔍</div>
            <h1 className="mb-2 text-2xl font-bold text-foreground">Release Not Found</h1>
            <p className="mb-8 text-muted-foreground">
              Version <strong>v{version}</strong> does not exist or has been removed.
            </p>
            <Button asChild variant="secondary">
              <Link to="/"><ArrowLeft className="h-4 w-4" />Go Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const directDownloadUrl = `${window.location.origin}/dl/${release.version}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(directDownloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const INFO_ITEMS = [
    { icon: Tag, label: 'Version', value: `v${release.version}` },
    { icon: HardDrive, label: 'File Size', value: formatSize(release.size) },
    { icon: Calendar, label: 'Release Date', value: formatDate(release.created_at) },
    { icon: FileText, label: 'Filename', value: release.filename, small: true },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-white/20 bg-white/5 backdrop-blur-lg dark:border-white/10 dark:bg-black/20 shadow-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-foreground no-underline">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-sm">
              ☁️
            </div>
            AP-Cloud
          </Link>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Badge variant="green" className="hidden sm:inline-flex">
              <Check className="h-3 w-3" /> Verified Release
            </Badge>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* ── Hero ── */}
        <div className="relative overflow-hidden py-16 text-center">
          {/* Radial glow */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,rgba(139,92,246,0.1)_0%,transparent_70%)]" />

          {/* App icon */}
          <div className="animate-float mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[22px] bg-gradient-to-br from-blue-600 to-blue-700 text-4xl shadow-[0_8px_32px_rgba(37,99,235,0.4),0_0_0_1px_rgba(255,255,255,0.1)]">
            {getFileIcon(release.filename)}
          </div>

          <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            {release.app_name}
          </h1>
          <p className="mx-auto mb-5 max-w-md text-base text-muted-foreground">
            The latest official release, securely hosted and ready to download.
          </p>
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            <Badge variant="default">v{release.version}</Badge>
            <Badge variant="purple">{release.filename.split('.').pop()?.toUpperCase()}</Badge>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-5 pb-16">
          {/* ── Info Grid ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {INFO_ITEMS.map(({ icon: Icon, label, value, small }) => (
              <Card key={label} className="text-center hover:border-blue-300/60">
                <CardContent className="pt-5 pb-4">
                  <Icon className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {label}
                  </p>
                  <p
                    className={`font-bold text-foreground ${small ? 'text-xs break-all' : 'text-base'}`}
                  >
                    {value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Download Button ── */}
          <div className="my-10 text-center">
            <a
              href={release.public_url}
              download
              id="download-now-btn"
              rel="noreferrer"
              className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-12 py-5 text-lg font-bold text-white shadow-[0_8px_32px_rgba(37,99,235,0.4)] no-underline transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(37,99,235,0.55)] active:translate-y-0"
            >
              <Download className="h-5 w-5 animate-bounce-down" />
              Download Now
              <span className="text-sm font-normal opacity-80">· {formatSize(release.size)}</span>
            </a>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              File served directly from Supabase Storage — no login required
            </p>
          </div>

          {/* ── Release Notes ── */}
          {release.release_notes && (
            <Card className="mb-4 text-left">
              <CardContent className="pt-6">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  📋 Release Notes
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {release.release_notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Direct Download URL ── */}
          <Card className="text-center">
            <CardContent className="pt-6">
              <p className="mb-3 text-xs text-muted-foreground">
                🤖 Use this URL in{' '}
                <code className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-600 dark:text-blue-400">
                  version.json
                </code>{' '}
                for auto-updates
              </p>
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 p-3">
                <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
                  {directDownloadUrl}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 flex-shrink-0"
                  id="copy-direct-url-btn"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" /> Copy</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        AP-Cloud ·{' '}
        <a href="/admin" className="text-muted-foreground hover:text-foreground">
          Admin
        </a>{' '}
        · Powered by Supabase
      </footer>
    </div>
  );
};

export default DownloadPage;
