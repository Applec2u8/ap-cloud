import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ThemeSwitcher from '../components/ThemeSwitcher';
import QuickSetup from '../components/QuickSetup';
import ManualUpload from '../components/ManualUpload';
import FileExplorer from '../components/FileExplorer';
import Breadcrumbs from '../components/Breadcrumbs';
import { useRepo } from '../context/RepoContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../supabaseClient';
import {
  GitBranch, Copy, Clock, CheckCircle2, Code, BookOpen,
  ArrowLeft, ChevronDown, GitCommit, History, Download,
  Loader2, FolderOpen, AlertCircle, RefreshCw, Settings,
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
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/" className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-sm shadow-sm flex-shrink-0">☁️</Link>
            <div className="text-sm font-semibold flex items-center gap-1.5 min-w-0">
              <Link to="#" className="text-blue-500 hover:underline flex-shrink-0">{resolvedOwner}</Link>
              <span className="text-muted-foreground">/</span>
              <span className="font-bold">{resolvedRepo}</span>
              <Badge variant="outline" className="ml-2 text-[10px] uppercase font-bold tracking-wider">
                {repoInfo?.visibility === 'private' ? 'Private' : 'Public'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <ThemeSwitcher />
            <Button variant="secondary" size="sm" asChild>
              <Link to="/cloud-admin" className="h-8 gap-2 rounded-full px-4">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Admin</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex gap-1 border-t border-border/40">
          {[
            { label: 'Code', to: `/repo/${resolvedOwner}/${resolvedRepo}`, icon: null, active: true },
            { label: 'Settings', to: `/repo/${resolvedOwner}/${resolvedRepo}/settings`, icon: <Settings className="h-3.5 w-3.5" />, active: false },
          ].map(tab => (
            <Link
              key={tab.label}
              to={tab.to}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px
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

          {/* Repo Header Row */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="outline" size="sm" className="h-9 gap-2 bg-muted/20 border-border/50">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{branch}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <GitCommit className="h-4 w-4" />
                <span className="font-semibold text-foreground">{commits.length}</span> commits
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground ml-2">
                <FolderOpen className="h-4 w-4" />
                <span className="font-semibold text-foreground">{files.length}</span> files
              </div>
            </div>
            <Button
              id="toggle-quick-setup-btn"
              variant="default"
              className={`h-9 gap-2 transition-all ${showQuickSetup ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              onClick={() => setShowQuickSetup(p => !p)}
            >
              <Code className="h-4 w-4" />
              {showQuickSetup ? 'Hide Setup' : 'Code'}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showQuickSetup ? 'rotate-180' : ''}`} />
            </Button>
          </div>

          {/* Quick Setup + Upload Panel */}
          {showQuickSetup && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mb-6">
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
                        <div className="bg-muted/40 px-4 py-3 border-b border-border/60 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 font-medium">
                            <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                              <span className="text-xs">🤖</span>
                            </div>
                            <span className="font-bold">ap-cloud-bot</span>
                            <span className="text-muted-foreground truncate max-w-xs">{activeCommit?.message ?? 'Initial commit'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{activeCommit ? timeAgo(activeCommit.created_at) : '—'}</span>
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
                      <div className="p-8">
                        <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{readmeContent}</ReactMarkdown>
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
                          className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30 ${activeCommit?.id === commit.id ? 'bg-blue-500/5' : ''}`}
                        >
                          <div className="flex-shrink-0">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                              {idx === 0 ? 'HEAD' : String(commits.length - idx)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{commit.message}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <code className="text-xs font-mono text-blue-400">{commit.commit_hash}</code>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />{timeAgo(commit.created_at)}
                              </span>
                              {activeCommit?.id === commit.id && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/15 text-blue-400 border-blue-500/30">active</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => handleSelectCommit(commit)}>
                              <FolderOpen className="h-3 w-3 mr-1" /> Browse
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => handleDownloadCommit(commit)}>
                              <Download className="h-3 w-3 mr-1" /> Download
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
