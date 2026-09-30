import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ThemeSwitcher from '../components/ThemeSwitcher';
import QuickSetup from '../components/QuickSetup';
import ManualUpload from '../components/ManualUpload';
import FileExplorer from '../components/FileExplorer';
import Breadcrumbs from '../components/Breadcrumbs';
import RepoReleasesSidebar from '../components/RepoReleasesSidebar';
import { useRepo } from '../context/RepoContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../supabaseClient';
import { parseUA } from '../lib/uaParser';
import {
  GitBranch, Copy, Clock, CheckCircle2, Code, BookOpen,
  ArrowLeft, ChevronDown, GitCommit, History, Download,
  Loader2, FolderOpen, AlertCircle, RefreshCw, Settings, Tag, LinkIcon, FileText
} from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useFileVisibility } from '../hooks/useFileVisibility';
import { downloadFilteredZip } from '../lib/downloadFilteredZip';

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}


const RepositoryPage: React.FC = () => {
  const { owner, repoName } = useParams();
  const resolvedOwner = owner ?? 'ap-cloud';
  const resolvedRepo = repoName ?? 'repo';


  const {
    repoInfo, commits, activeCommit, files,
    loadingRepo, loadingFiles, repoError, filesError,
    loadRepo, loadCommits, loadFiles,
  } = useRepo();
  const { isAdmin } = useAdmin();
  const { visibilityMap, setVisibility } = useFileVisibility(repoInfo?.id);

  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'history'>('files');
  const [copied, setCopied] = useState(false);
  const [expandedMdFiles, setExpandedMdFiles] = useState<Set<string>>(new Set(['readme.md']));
  // Tracks which files have been mounted at least once (avoids re-rendering on every toggle)
  const [mountedMdFiles, setMountedMdFiles] = useState<Set<string>>(new Set(['readme.md']));

  const branch = repoInfo?.default_branch ?? 'main';
  const repoUrl = `${window.location.origin}/repo/${resolvedOwner}/${resolvedRepo}`;

  // Load on mount
  useEffect(() => {
    (async () => {
      let repo = repoInfo;
      if (!repo || repo.name !== resolvedRepo) {
        repo = await loadRepo(resolvedRepo);
      }
      if (!repo) return;
      let commitList = commits;
      if (commitList.length === 0) {
        commitList = await loadCommits(repo.id);
      }
      if (commitList.length > 0 && files.length === 0) {
        await loadFiles(repo.id, commitList[0]);
      }

      // ── Track Repository View (throttled 30min, rich UA data) ──
      const trackKey = `ap_cloud_view_${repo.id}`;
      const lastTracked = localStorage.getItem(trackKey);
      const now = Date.now();
      if (!lastTracked || now - parseInt(lastTracked, 10) > 1800000) {
        const ua = parseUA();
        supabase.from('repository_views').insert({
          repository_id: repo.id,
          user_agent: navigator.userAgent,
          device_type: ua.deviceType,
          device_name: ua.deviceName,
          browser: ua.browser,
          os: ua.os,
        }).then(() => {
          localStorage.setItem(trackKey, now.toString());
        }, console.error);
      }
    })();
  }, [resolvedRepo]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(repoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectCommit = async (commit: typeof commits[0]) => {
    if (!repoInfo) return;
    setActiveTab('files');
    await loadFiles(repoInfo.id, commit);
  };

  const handleDownloadCommit = async (commit: typeof commits[0]) => {
    if (!repoInfo) return;

    // ── Track source code download (rich UA data) ──
    const ua = parseUA();
    void supabase.from('download_logs').insert({
      repository_id: repoInfo.id,
      version: commit.commit_hash.slice(0, 7),
      download_type: 'source_code',
      device_type: ua.deviceType,
      device_name: ua.deviceName,
      browser: ua.browser,
      os: ua.os,
    }).then(undefined, console.error);

    try {
      await downloadFilteredZip(
        repoInfo.id,
        commit.commit_hash,
        repoInfo.name,
        visibilityMap,
        isAdmin,
      );
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleUploadSuccess = async () => {
    if (!repoInfo) return;
    const commitList = await loadCommits(repoInfo.id);
    if (commitList.length > 0) {
      await loadFiles(repoInfo.id, commitList[0]);
      setActiveTab('files');
      setShowQuickSetup(false);
    }
  };

  // All .md files sorted: README.md first, then others by path
  const mdFiles = useMemo(() => files
    .filter(f => f.path.toLowerCase().endsWith('.md'))
    .sort((a, b) => {
      const aIsReadme = a.path.toLowerCase() === 'readme.md';
      const bIsReadme = b.path.toLowerCase() === 'readme.md';
      if (aIsReadme) return -1;
      if (bIsReadme) return 1;
      return a.path.localeCompare(b.path);
    })
    .map(f => ({ path: f.path, content: new TextDecoder().decode(f.content) })),
  [files]);

  const toggleMdFile = (path: string) => {
    const key = path.toLowerCase();
    setExpandedMdFiles(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // Lazy mount: mark as mounted on first expand
        setMountedMdFiles(m => new Set([...m, key]));
      }
      return next;
    });
  };

  const isExpanded = (path: string) => expandedMdFiles.has(path.toLowerCase());
  const isMounted = (path: string) => mountedMdFiles.has(path.toLowerCase());

  // Memoized markdown component map — stable reference avoids ReactMarkdown re-renders
  const mdComponents = useMemo(() => ({
    h1: ({ children }: { children: React.ReactNode }) => <h1 style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.25, marginTop: 0, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid hsl(var(--border))', letterSpacing: '-0.02em' }}>{children}</h1>,
    h2: ({ children }: { children: React.ReactNode }) => <h2 style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3, marginTop: '2rem', marginBottom: '0.75rem', paddingBottom: '0.35rem', borderBottom: '1px solid hsl(var(--border))', letterSpacing: '-0.01em' }}>{children}</h2>,
    h3: ({ children }: { children: React.ReactNode }) => <h3 style={{ fontSize: '1.2rem', fontWeight: 600, lineHeight: 1.4, marginTop: '1.5rem', marginBottom: '0.5rem' }}>{children}</h3>,
    h4: ({ children }: { children: React.ReactNode }) => <h4 style={{ fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.4, marginTop: '1.25rem', marginBottom: '0.4rem' }}>{children}</h4>,
    h5: ({ children }: { children: React.ReactNode }) => <h5 style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '1rem', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--muted-foreground))' }}>{children}</h5>,
    h6: ({ children }: { children: React.ReactNode }) => <h6 style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '0.75rem', marginBottom: '0.3rem', color: 'hsl(var(--muted-foreground))' }}>{children}</h6>,
    p: ({ children }: { children: React.ReactNode }) => <p style={{ marginTop: 0, marginBottom: '1rem' }}>{children}</p>,
    a: ({ href, children }: { href?: string; children: React.ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline', textUnderlineOffset: '3px' }}>{children}</a>,
    code: ({ className: cls, children, ...props }: { className?: string; children: React.ReactNode }) => {
      const isInline = !cls;
      return isInline
        ? <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85em', background: 'hsl(var(--muted))', padding: '0.15em 0.4em', borderRadius: '4px', border: '1px solid hsl(var(--border))' }} {...props}>{children}</code>
        : <code className={cls} {...props}>{children}</code>;
    },
    pre: ({ children }: { children: React.ReactNode }) => <pre style={{ background: '#0d1117', border: '1px solid hsl(var(--border))', borderRadius: '8px', padding: '1rem 1.25rem', overflowX: 'auto', margin: '1rem 0', fontFamily: 'ui-monospace, monospace', fontSize: '13px', lineHeight: 1.65, color: '#e6edf3' }}>{children}</pre>,
    ul: ({ children }: { children: React.ReactNode }) => <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginTop: 0, marginBottom: '1rem' }}>{children}</ul>,
    ol: ({ children }: { children: React.ReactNode }) => <ol style={{ listStyleType: 'decimal', paddingLeft: '1.5rem', marginTop: 0, marginBottom: '1rem' }}>{children}</ol>,
    li: ({ children }: { children: React.ReactNode }) => <li style={{ marginBottom: '0.35rem' }}>{children}</li>,
    blockquote: ({ children }: { children: React.ReactNode }) => <blockquote style={{ borderLeft: '4px solid hsl(var(--primary) / 0.5)', paddingLeft: '1.25rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', margin: '1rem 0', background: 'hsl(var(--muted) / 0.5)', borderRadius: '0 6px 6px 0', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>{children}</blockquote>,
    hr: () => <hr style={{ border: 'none', borderTop: '1px solid hsl(var(--border))', margin: '2rem 0' }} />,
    table: ({ children }: { children: React.ReactNode }) => <div style={{ overflowX: 'auto', margin: '1rem 0', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>{children}</table></div>,
    th: ({ children }: { children: React.ReactNode }) => <th style={{ background: 'hsl(var(--muted))', padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', borderBottom: '2px solid hsl(var(--border))' }}>{children}</th>,
    td: ({ children }: { children: React.ReactNode }) => <td style={{ padding: '0.6rem 1rem', borderBottom: '1px solid hsl(var(--border) / 0.6)' }}>{children}</td>,
    strong: ({ children }: { children: React.ReactNode }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
    em: ({ children }: { children: React.ReactNode }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
  }), []);


  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-lg shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Link to="/" className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-sm shadow-sm flex-shrink-0">☁️</Link>
            <div className="text-xs sm:text-sm font-semibold flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
              <Link to="#" className="text-blue-500 hover:underline shrink-0 max-w-[70px] sm:max-w-[120px] truncate">{resolvedOwner}</Link>
              <span className="text-muted-foreground shrink-0">/</span>
              <span className="font-bold truncate max-w-[110px] sm:max-w-[200px] md:max-w-none">{resolvedRepo}</span>
              <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider shrink-0 px-1.5 py-0">
                {repoInfo?.visibility === 'private' ? 'Private' : 'Public'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <ThemeSwitcher />
            <Button variant="secondary" size="sm" asChild>
              <Link to="/cloud-admin" className="h-8 gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-4">
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="hidden md:inline">Back to Admin</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mx-auto max-w-6xl px-3 sm:px-6 flex gap-1 border-t border-border/40 overflow-x-auto no-scrollbar flex-nowrap">
          {[
            { label: 'Code', to: `/repo/${resolvedOwner}/${resolvedRepo}`, icon: <Code className="h-3.5 w-3.5" />, active: true },
            { label: 'Releases', to: `/repo/${resolvedOwner}/${resolvedRepo}/releases`, icon: <Tag className="h-3.5 w-3.5" />, active: false },
            { label: 'Links', to: `/repo/${resolvedOwner}/${resolvedRepo}/links`, icon: <LinkIcon className="h-3.5 w-3.5" />, active: false },
            { label: 'Settings', to: `/repo/${resolvedOwner}/${resolvedRepo}/settings`, icon: <Settings className="h-3.5 w-3.5" />, active: false },
          ].map(tab => (
            <Link
              key={tab.label}
              to={tab.to}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px shrink-0 whitespace-nowrap
                ${tab.active
                  ? 'border-blue-500 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tab.icon}
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="flex-1 px-3 sm:px-6 py-6 sm:py-8">
        <div className="mx-auto max-w-6xl w-full">

          {/* Repo Header Row */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              <Button variant="outline" size="sm" className="h-8.5 gap-2 bg-muted/20 border-border/50 text-xs sm:text-sm">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{branch}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                <GitCommit className="h-3.5 w-3.5" />
                <span className="font-semibold text-foreground">{commits.length}</span> commits
              </div>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                <FolderOpen className="h-3.5 w-3.5" />
                <span className="font-semibold text-foreground">{files.length}</span> files
              </div>
              
              {/* Prominent Download Button */}
              {activeCommit && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8.5 gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300 ml-2"
                  onClick={() => handleDownloadCommit(activeCommit)}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Download Code</span>
                  <span className="sm:hidden">Download</span>
                </Button>
              )}
            </div>
            <Button
              id="toggle-quick-setup-btn"
              variant="default"
              size="sm"
              className={`h-8.5 gap-2 transition-all self-start sm:self-auto text-xs sm:text-sm font-semibold ${showQuickSetup ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              onClick={() => setShowQuickSetup(p => !p)}
            >
              <Code className="h-3.5 w-3.5" />
              {showQuickSetup ? 'Hide Setup' : 'Code'}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showQuickSetup ? 'rotate-180' : ''}`} />
            </Button>
          </div>

          {/* Quick Setup + Upload Panel */}
          {showQuickSetup && (
            <div className="grid grid-cols-1 gap-6 items-start mb-6">
              <QuickSetup owner={resolvedOwner} repoName={resolvedRepo} />
              {isAdmin && <ManualUpload owner={resolvedOwner} repoName={resolvedRepo} onUploadSuccess={handleUploadSuccess} />}
            </div>
          )}

          {/* Loading / Error */}
          {loadingRepo && (
            <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading repository...</span>
            </div>
          )}
          {repoError && !loadingRepo && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center mb-8">
              <AlertCircle className="mx-auto h-10 w-10 text-red-400 mb-3" />
              <p className="text-sm font-medium text-red-400 mb-1">Repository not found</p>
              <p className="text-xs text-muted-foreground">{repoError}</p>
            </div>
          )}

          {!loadingRepo && !repoError && (
            <>
              {/* Tabs */}
              <div className="flex gap-1 mb-5 border-b border-border/60">
                {(['files', 'history'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
                      ${activeTab === tab ? 'border-blue-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  >
                    {tab === 'files' ? <FolderOpen className="h-4 w-4" /> : <History className="h-4 w-4" />}
                    {tab === 'files' ? 'Files' : 'Commit History'}
                    {tab === 'history' && commits.length > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{commits.length}</Badge>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Files Tab ── */}
              {activeTab === 'files' && (
                <>
                  {/* Active commit banner */}
                  {activeCommit && (
                    <div className="mb-4 rounded-lg border border-border/50 bg-muted/30 px-4 py-2.5 flex items-center gap-2 text-sm flex-wrap">
                      <GitCommit className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <code className="font-mono text-blue-400 text-xs">{activeCommit.commit_hash}</code>
                      <span className="text-muted-foreground truncate flex-1">{activeCommit.message}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                        <Clock className="h-3 w-3" />{timeAgo(activeCommit.created_at)}
                      </span>
                    </div>
                  )}

                  {/* Two-column layout: main content + releases sidebar */}
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
                    <div className="min-w-0 w-full">
                      {/* File Explorer card */}
                      <div className="mb-8 rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
                        {loadingFiles ? (
                          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm">Extracting repository files...</span>
                          </div>
                        ) : filesError ? (
                          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                            <AlertCircle className="h-8 w-8 text-red-400" />
                            <p className="text-sm">Failed to load files: {filesError}</p>
                            {activeCommit && repoInfo && (
                              <Button variant="outline" size="sm" onClick={() => loadFiles(repoInfo.id, activeCommit)}>
                                <RefreshCw className="h-3.5 w-3.5 mr-2" /> Retry
                              </Button>
                            )}
                          </div>
                        ) : files.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                            <FolderOpen className="h-10 w-10" />
                            <p className="text-sm">No files yet. {isAdmin ? 'Push code using the CLI or upload files manually.' : 'Check back later.'}</p>
                            {isAdmin && (
                              <Button variant="outline" size="sm" onClick={() => setShowQuickSetup(true)}>
                                <Code className="h-3.5 w-3.5 mr-2" /> Get Started
                              </Button>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Commit info bar */}
                            <div className="bg-muted/40 px-4 py-3 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                              <div className="flex items-center gap-2 font-medium min-w-0 flex-1">
                                <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                  <span className="text-xs">🤖</span>
                                </div>
                                <span className="font-bold shrink-0">ap-cloud-bot</span>
                                <span className="text-muted-foreground truncate">{activeCommit?.message ?? 'Initial commit'}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-muted-foreground text-xs shrink-0">
                                <Clock className="h-3.5 w-3.5" />
                                <span className="whitespace-nowrap">{activeCommit ? timeAgo(activeCommit.created_at) : '—'}</span>
                              </div>
                            </div>

                            {/* Breadcrumbs row */}
                            <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                              <Breadcrumbs owner={resolvedOwner} repoName={resolvedRepo} branch={branch} path="" />
                            </div>

                            <FileExplorer
                              files={files}
                              owner={resolvedOwner}
                              repoName={resolvedRepo}
                              branch={branch}
                              basePath=""
                              currentPath=""
                              isAdmin={isAdmin}
                              visibilityMap={visibilityMap}
                              onToggleVisibility={setVisibility}
                            />
                          </>
                        )}
                      </div>

                      {/* All .md files — README expanded by default, others collapsed */}
                      {!loadingFiles && mdFiles.length > 0 && (
                        <div className="flex flex-col gap-3 mb-8">
                          {mdFiles.map((mdFile) => {
                            const isReadme = mdFile.path.toLowerCase() === 'readme.md';
                            const expanded = isExpanded(mdFile.path);
                            const filename = mdFile.path.split('/').pop() ?? mdFile.path;
                            return (
                              <div key={mdFile.path} className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
                                {/* Header / Toggle */}
                                <button
                                  onClick={() => toggleMdFile(mdFile.path)}
                                  className="w-full bg-muted/40 px-4 py-3 flex items-center gap-2 hover:bg-muted/60 transition-colors text-left"
                                  style={{ borderBottom: expanded ? '1px solid hsl(var(--border) / 0.6)' : 'none' }}
                                >
                                  <ChevronDown
                                    className="h-4 w-4 text-muted-foreground flex-shrink-0"
                                    style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 280ms cubic-bezier(0.4,0,0.2,1)' }}
                                  />
                                  {isReadme
                                    ? <BookOpen className="h-4 w-4 text-blue-400 flex-shrink-0" />
                                    : <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  }
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-sm">{filename}</span>
                                    {mdFile.path !== filename && (
                                      <span className="text-[11px] text-muted-foreground font-mono truncate">{mdFile.path}</span>
                                    )}
                                  </div>
                                  {isReadme && (
                                    <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-400/10 border border-blue-400/20 px-1.5 py-0.5 rounded">Main</span>
                                  )}
                                  {isReadme && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleCopyUrl(); }}
                                      className={`ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${copied
                                        ? 'text-green-400 bg-green-400/10 border border-green-400/20'
                                        : 'text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted border border-border/40'
                                      }`}
                                    >
                                      {copied ? <><CheckCircle2 className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy URL</>}
                                    </button>
                                  )}
                                </button>

                                {/* Content — CSS Grid trick for smooth height animation */}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateRows: expanded ? '1fr' : '0fr',
                                    transition: 'grid-template-rows 300ms cubic-bezier(0.4,0,0.2,1)',
                                  }}
                                >
                                  <div style={{ overflow: 'hidden' }}>
                                    {isMounted(mdFile.path) ? (
                                      <div className="p-4 sm:p-6 md:p-8 min-w-0 max-w-full">
                                        <div style={{ fontSize: '15px', lineHeight: '1.75' }}>
                                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as never}>
                                            {mdFile.content}
                                          </ReactMarkdown>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        กำลังโหลด...
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!loadingFiles && files.length > 0 && mdFiles.length === 0 && (
                        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm mb-8">
                          <div className="bg-muted/40 px-4 py-3 border-b border-border/60 flex items-center gap-2 font-semibold">
                            <BookOpen className="h-4 w-4" /> README.md
                          </div>
                          <div className="p-8 text-center text-muted-foreground text-sm">
                            No README.md found in this repository.
                          </div>
                        </div>
                      )}
                    </div>{/* end main col */}

                    {/* Releases sidebar */}
                    {repoInfo && (
                      <div className="lg:sticky lg:top-24 w-full min-w-0">
                        <RepoReleasesSidebar
                          repoId={repoInfo.id}
                          owner={resolvedOwner}
                          repoName={resolvedRepo}
                        />
                      </div>
                    )}
                  </div>{/* end grid */}
                </>
              )}

              {/* ── History Tab ── */}
              {activeTab === 'history' && (
                <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm mb-8">
                  <div className="bg-muted/40 px-4 py-3 border-b border-border/60 flex items-center gap-2 font-semibold text-sm">
                    <History className="h-4 w-4" />
                    Commit History
                    <Badge variant="outline" className="ml-auto text-xs">{commits.length} commits</Badge>
                  </div>
                  {commits.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground text-sm">No commits yet. Push your first version!</div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {commits.map((commit, idx) => (
                        <div
                          key={commit.id}
                          className={cn(
                            "flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4 transition-colors hover:bg-muted/30",
                            activeCommit?.id === commit.id && "bg-blue-500/5"
                          )}
                        >
                          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                            <div className="flex-shrink-0 mt-0.5 sm:mt-0">
                              <div className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                                idx === 0 ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-muted text-muted-foreground border border-border/50'
                              )}>
                                {idx === 0 ? 'HEAD' : String(commits.length - idx)}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{commit.message}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <code className="text-xs font-mono text-blue-500 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 whitespace-nowrap">
                                  {commit.commit_hash.slice(0, 7)}
                                </code>
                                <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                                  <Clock className="h-3 w-3" />{timeAgo(commit.created_at)}
                                </span>
                                {activeCommit?.id === commit.id && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/15 text-blue-400 border-blue-500/30 whitespace-nowrap">
                                    active
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t border-border/30 sm:border-t-0 justify-end">
                            <Button variant="outline" size="sm" className="h-7.5 px-3 text-xs gap-1.5" onClick={() => handleSelectCommit(commit)}>
                              <FolderOpen className="h-3.5 w-3.5" /> Browse
                            </Button>
                            <Button variant="outline" size="sm" className="h-7.5 px-3 text-xs gap-1.5" onClick={() => handleDownloadCommit(commit)}>
                              <Download className="h-3.5 w-3.5" /> Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-border py-8 mt-12">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 sm:mb-0">
            <span className="text-lg">☁️</span>
            <span className="font-semibold text-foreground">AP-Cloud</span>
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground hover:underline transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground hover:underline transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground hover:underline transition-colors">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RepositoryPage;
