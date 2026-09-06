import React, { useState, useEffect } from 'react';
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
import {
  GitBranch, Copy, Clock, CheckCircle2, Code, BookOpen,
  ArrowLeft, ChevronDown, GitCommit, History, Download,
  Loader2, FolderOpen, AlertCircle, RefreshCw, Settings, Tag, LinkIcon
} from 'lucide-react';

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

  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'history'>('files');
  const [copied, setCopied] = useState(false);

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
    const path = `${repoInfo.id}/${commit.commit_hash}/source.zip`;
    const { data } = await supabase.storage.from('repo-storage').createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
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

  // README at root
  const readmeContent = (() => {
    const f = files.find(f => f.path.toLowerCase() === 'readme.md');
    return f ? new TextDecoder().decode(f.content) : null;
  })();

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
              <ManualUpload owner={resolvedOwner} repoName={resolvedRepo} onUploadSuccess={handleUploadSuccess} />
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
                            <p className="text-sm">No files yet. Push code using the CLI or upload files manually.</p>
                            <Button variant="outline" size="sm" onClick={() => setShowQuickSetup(true)}>
                              <Code className="h-3.5 w-3.5 mr-2" /> Get Started
                            </Button>
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
                            />
                          </>
                        )}
                      </div>

                      {/* README */}
                      {readmeContent && !loadingFiles && (
                        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm mb-8">
                          <div className="bg-muted/40 px-4 py-3 border-b border-border/60 flex items-center gap-2 font-semibold">
                            <BookOpen className="h-4 w-4" />
                            README.md
                            <button
                              id="copy-readme-url-btn"
                              onClick={handleCopyUrl}
                              className={`ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${copied
                                ? 'text-green-400 bg-green-400/10 border border-green-400/20'
                                : 'text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted border border-border/40'
                                }`}
                            >
                              {copied ? <><CheckCircle2 className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy URL</>}
                            </button>
                          </div>
                          <div className="p-4 sm:p-6 md:p-8 min-w-0 max-w-full overflow-hidden">
                            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none break-words min-w-0">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  pre: ({ node, ...props }) => (
                                    <div className="overflow-x-auto max-w-full my-3 rounded-lg border border-border/50 bg-[#0d1117] dark:bg-black/40 p-3 sm:p-4">
                                      <pre {...props} className="text-xs sm:text-sm font-mono whitespace-pre text-[#e6edf3]" />
                                    </div>
                                  ),
                                  table: ({ node, ...props }) => (
                                    <div className="overflow-x-auto max-w-full my-3">
                                      <table {...props} className="w-full text-left border-collapse text-sm" />
                                    </div>
                                  ),
                                }}
                              >
                                {readmeContent}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      )}

                      {!loadingFiles && files.length > 0 && !readmeContent && (
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
