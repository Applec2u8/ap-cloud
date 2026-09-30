import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useRepo } from '../context/RepoContext';
import Breadcrumbs from '../components/Breadcrumbs';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, Copy, Check, Loader2, AlertCircle, Download, FileText, Tag, Settings, Link as LinkIcon, Lock,
} from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useFileVisibility, getEffectiveVisibility } from '../hooks/useFileVisibility';

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    json: 'json', md: 'markdown', html: 'html', css: 'css',
    scss: 'scss', sh: 'bash', yml: 'yaml', yaml: 'yaml',
    toml: 'toml', sql: 'sql', py: 'python', rs: 'rust', go: 'go',
    java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp', php: 'php',
    rb: 'ruby', swift: 'swift', kt: 'kotlin', xml: 'xml', svg: 'xml',
  };
  return map[ext] ?? 'text';
}

function isImage(filename: string): boolean {
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp']
    .includes(filename.split('.').pop()?.toLowerCase() ?? '');
}

const BlobPage: React.FC = () => {
  const { owner, repoName, branch, '*': splat } = useParams<{
    owner: string; repoName: string; branch: string; '*': string;
  }>();

  const resolvedOwner = owner ?? 'ap-cloud';
  const resolvedRepo = repoName ?? 'repo';
  const resolvedBranch = branch ?? 'main';
  const filePath = splat ?? '';

  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { isAdmin } = useAdmin();
  const {
    repoInfo, commits, files,
    loadingRepo, loadingFiles, repoError,
    loadRepo, loadCommits, loadFiles,
  } = useRepo();
  const { visibilityMap } = useFileVisibility(repoInfo?.id);

  // Load data if needed
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
    })();
  }, [resolvedRepo]);

  const file = useMemo(() => files.find(f => f.path === filePath), [files, filePath]);

  const content = useMemo(() => {
    if (!file || isImage(filePath)) return null;
    try { return new TextDecoder('utf-8').decode(file.content); }
    catch { return '(Unable to decode file content)'; }
  }, [file, filePath]);

  const imageUrl = useMemo(() => {
    if (!file || !isImage(filePath)) return null;
    return URL.createObjectURL(new Blob([file.content.buffer as ArrayBuffer]));
  }, [file, filePath]);

  const filename = filePath.split('/').pop() ?? filePath;
  const lang = getLanguage(filename);
  const lines = content ? content.split('\n').length : 0;
  const sizeKb = file ? (file.content.length / 1024).toFixed(1) : '0';

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!file) return;
    const blob = new Blob([file.content as unknown as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // ── Security guard: block private file access for non-admins ──────────
  const isPrivateFile = !getEffectiveVisibility(filePath, visibilityMap);
  if (!isAdmin && isPrivateFile && filePath) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-8">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/20">
            <Lock className="h-8 w-8 text-orange-400" />
          </div>
          <h1 className="text-xl font-bold">Access Restricted</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            <span className="font-mono text-foreground/80 bg-muted px-1.5 py-0.5 rounded text-xs">{filePath}</span>
            {' '}is marked as <span className="text-orange-400 font-semibold">Private</span>.
            You don't have permission to view this file's content.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-4 py-2 text-sm font-medium hover:bg-muted/70 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
        </div>
      </div>
    );
  }

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
              <Link to={`/repo/${resolvedOwner}/${resolvedRepo}`} className="font-bold hover:underline truncate max-w-[110px] sm:max-w-[200px] md:max-w-none">{resolvedRepo}</Link>
              <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider shrink-0 px-1.5 py-0">Public</Badge>
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
            { label: 'Code', to: `/repo/${resolvedOwner}/${resolvedRepo}`, icon: null, active: true },
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

      <main className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl">

          {/* Back link */}
          <button
            onClick={() => {
              const parentPath = filePath.includes('/')
                ? filePath.substring(0, filePath.lastIndexOf('/'))
                : '';
              if (parentPath) {
                navigate(`/repo/${resolvedOwner}/${resolvedRepo}/tree/${resolvedBranch}/${parentPath}`);
              } else {
                navigate(`/repo/${resolvedOwner}/${resolvedRepo}`);
              }
            }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>

          {(loadingRepo || loadingFiles) && (
            <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading file...</span>
            </div>
          )}

          {repoError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-red-400 mb-2" />
              <p className="text-sm text-red-400">{repoError}</p>
            </div>
          )}

          {!loadingRepo && !loadingFiles && !repoError && (
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
              {/* Breadcrumbs bar */}
              <div className="px-4 py-3 border-b border-border/60 bg-muted/40">
                <Breadcrumbs
                  owner={resolvedOwner}
                  repoName={resolvedRepo}
                  branch={resolvedBranch}
                  path={filePath}
                  isFile={true}
                />
              </div>

              {/* File meta bar */}
              <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  {!isImage(filename) && <span>{lines} lines</span>}
                  <span>{sizeKb} KB</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{lang}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {content && (
                    <button
                      onClick={handleCopy}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all border ${
                        copied
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-muted/60 text-muted-foreground hover:text-foreground border-border/60 hover:bg-muted'
                      }`}
                    >
                      {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                    </button>
                  )}
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium bg-muted/60 text-muted-foreground hover:text-foreground border border-border/60 hover:bg-muted transition-all"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                </div>
              </div>

              {/* File content */}
              {!file && !loadingFiles ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  File not found: <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{filePath}</code>
                </div>
              ) : imageUrl ? (
                <div className="flex items-center justify-center p-8 bg-[#0d1117]">
                  <img src={imageUrl} alt={filename} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                </div>
              ) : content !== null ? (
                lang === 'markdown' ? (
                  <div style={{ padding: '2rem 2.5rem', maxWidth: '860px', fontSize: '15px', lineHeight: '1.75' }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.25, marginTop: 0, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid hsl(var(--border))', letterSpacing: '-0.02em' }}>{children}</h1>,
                        h2: ({ children }) => <h2 style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3, marginTop: '2rem', marginBottom: '0.75rem', paddingBottom: '0.35rem', borderBottom: '1px solid hsl(var(--border))', letterSpacing: '-0.01em' }}>{children}</h2>,
                        h3: ({ children }) => <h3 style={{ fontSize: '1.2rem', fontWeight: 600, lineHeight: 1.4, marginTop: '1.5rem', marginBottom: '0.5rem' }}>{children}</h3>,
                        h4: ({ children }) => <h4 style={{ fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.4, marginTop: '1.25rem', marginBottom: '0.4rem' }}>{children}</h4>,
                        h5: ({ children }) => <h5 style={{ fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.4, marginTop: '1rem', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--muted-foreground))' }}>{children}</h5>,
                        h6: ({ children }) => <h6 style={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.4, marginTop: '0.75rem', marginBottom: '0.3rem', color: 'hsl(var(--muted-foreground))' }}>{children}</h6>,
                        p: ({ children }) => <p style={{ marginTop: 0, marginBottom: '1rem' }}>{children}</p>,
                        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline', textUnderlineOffset: '3px' }}>{children}</a>,
                        code: ({ className: cls, children, ...props }) => {
                          const isInline = !cls;
                          return isInline
                            ? <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85em', background: 'hsl(var(--muted))', padding: '0.15em 0.4em', borderRadius: '4px', border: '1px solid hsl(var(--border))' }} {...props}>{children}</code>
                            : <code className={cls} {...props}>{children}</code>;
                        },
                        pre: ({ children }) => <pre style={{ background: '#0d1117', border: '1px solid hsl(var(--border))', borderRadius: '8px', padding: '1rem 1.25rem', overflowX: 'auto', margin: '1rem 0', fontFamily: 'ui-monospace, monospace', fontSize: '13px', lineHeight: 1.65, color: '#e6edf3' }}>{children}</pre>,
                        ul: ({ children }) => <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginTop: 0, marginBottom: '1rem' }}>{children}</ul>,
                        ol: ({ children }) => <ol style={{ listStyleType: 'decimal', paddingLeft: '1.5rem', marginTop: 0, marginBottom: '1rem' }}>{children}</ol>,
                        li: ({ children }) => <li style={{ marginBottom: '0.35rem' }}>{children}</li>,
                        blockquote: ({ children }) => <blockquote style={{ borderLeft: '4px solid hsl(var(--primary) / 0.5)', paddingLeft: '1.25rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', margin: '1rem 0', background: 'hsl(var(--muted) / 0.5)', borderRadius: '0 6px 6px 0', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>{children}</blockquote>,
                        hr: () => <hr style={{ border: 'none', borderTop: '1px solid hsl(var(--border))', margin: '2rem 0' }} />,
                        table: ({ children }) => <div style={{ overflowX: 'auto', margin: '1rem 0', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>{children}</table></div>,
                        th: ({ children }) => <th style={{ background: 'hsl(var(--muted))', padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', borderBottom: '2px solid hsl(var(--border))' }}>{children}</th>,
                        td: ({ children }) => <td style={{ padding: '0.6rem 1rem', borderBottom: '1px solid hsl(var(--border) / 0.6)' }}>{children}</td>,
                        strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                        em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <SyntaxHighlighter
                    language={lang}
                    style={oneDark}
                    showLineNumbers
                    wrapLines
                    customStyle={{
                      margin: 0,
                      borderRadius: 0,
                      background: '#0d1117',
                      fontSize: '13px',
                      lineHeight: '1.6',
                    }}
                    lineNumberStyle={{
                      color: '#484f58',
                      userSelect: 'none',
                      minWidth: '3.5em',
                      borderRight: '1px solid rgba(255,255,255,0.08)',
                      paddingRight: '1em',
                      marginRight: '0.75em',
                    }}
                  >
                    {content}
                  </SyntaxHighlighter>
                )
              ) : (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                  Binary file — preview not available.
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default BlobPage;
