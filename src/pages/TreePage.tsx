import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useRepo } from '../context/RepoContext';
import FileExplorer from '../components/FileExplorer';
import Breadcrumbs from '../components/Breadcrumbs';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, GitBranch, ChevronDown, Loader2,
  AlertCircle, FolderOpen, RefreshCw, Clock, GitCommit,
} from 'lucide-react';

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

const TreePage: React.FC = () => {
  const { owner, repoName, branch, '*': splat } = useParams<{
    owner: string; repoName: string; branch: string; '*': string;
  }>();

  const resolvedOwner = owner ?? 'ap-cloud';
  const resolvedRepo = repoName ?? 'repo';
  const resolvedBranch = branch ?? 'main';
  const currentPath = splat ?? ''; // e.g. "src/components"

  const navigate = useNavigate();
  const {
    repoInfo, commits, activeCommit, files,
    loadingRepo, loadingFiles, repoError, filesError,
    loadRepo, loadCommits, loadFiles,
  } = useRepo();

  // Load repo + commits + files if not already loaded
  useEffect(() => {
    (async () => {
      let repo = repoInfo;
      if (!repo || repo.name !== resolvedRepo) {
        repo = await loadRepo(resolvedRepo);
      }
      if (!repo) return;

      let commitList = commits;
      if (commitList.length === 0 || commitList[0] && !files.length) {
        commitList = await loadCommits(repo.id);
      }

      if (commitList.length > 0 && files.length === 0) {
        await loadFiles(repo.id, commitList[0]);
      }
    })();
  }, [resolvedRepo]);


  // README in current dir
  const readme = files.find(f => {
    const name = currentPath
      ? f.path.startsWith(currentPath + '/') ? f.path.slice(currentPath.length + 1).toLowerCase() : null
      : f.path.toLowerCase();
    return name === 'readme.md';
  });
  const readmeContent = readme ? new TextDecoder().decode(readme.content) : null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-lg shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/" className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-sm shadow-sm flex-shrink-0">☁️</Link>
            <div className="text-sm font-semibold flex items-center gap-1.5 min-w-0">
              <Link to="#" className="text-blue-500 hover:underline flex-shrink-0">{resolvedOwner}</Link>
              <span className="text-muted-foreground flex-shrink-0">/</span>
              <Link to={`/repo/${resolvedOwner}/${resolvedRepo}`} className="font-bold hover:underline flex-shrink-0">{resolvedRepo}</Link>
              <Badge variant="outline" className="ml-2 text-[10px] uppercase font-bold tracking-wider flex-shrink-0">Public</Badge>
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
      </nav>

      <main className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl">

          {/* Branch + meta row */}
          <div className="mb-5 flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" className="h-9 gap-2 bg-muted/20 border-border/50">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{resolvedBranch}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <GitCommit className="h-4 w-4" />
              <span className="font-semibold text-foreground">{commits.length}</span> commits
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
              <span className="font-semibold text-foreground">{files.length}</span> files
            </div>
          </div>

          {/* Loading / Error */}
          {(loadingRepo || loadingFiles) && (
            <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>{loadingRepo ? 'Loading repository...' : 'Extracting files...'}</span>
            </div>
          )}
          {repoError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-red-400 mb-2" />
              <p className="text-sm text-red-400">{repoError}</p>
            </div>
          )}

          {!loadingRepo && !loadingFiles && !repoError && (
            <>
              {/* File explorer card */}
              <div className="mb-6 rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
                {/* Commit info bar */}
                {activeCommit && (
                  <div className="bg-muted/40 px-4 py-3 border-b border-border/60 flex items-center gap-2 text-sm flex-wrap">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs">🤖</span>
                      </div>
                      <span className="font-bold flex-shrink-0">ap-cloud-bot</span>
                      <span className="text-muted-foreground truncate">{activeCommit.message}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs flex-shrink-0">
                      <code className="font-mono text-blue-400">{activeCommit.commit_hash}</code>
                      <span>·</span>
                      <Clock className="h-3 w-3" />
                      <span>{timeAgo(activeCommit.created_at)}</span>
                    </div>
                  </div>
                )}

                {/* Breadcrumbs row */}
                <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                  <Breadcrumbs
                    owner={resolvedOwner}
                    repoName={resolvedRepo}
                    branch={resolvedBranch}
                    path={currentPath}
                    isFile={false}
                  />
                </div>

                {/* Files listing */}
                {filesError ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 text-red-400" />
                    <p className="text-sm">{filesError}</p>
                    {activeCommit && repoInfo && (
                      <Button variant="outline" size="sm" onClick={() => loadFiles(repoInfo.id, activeCommit)}>
                        <RefreshCw className="h-3.5 w-3.5 mr-2" /> Retry
                      </Button>
                    )}
                  </div>
                ) : files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
                    <FolderOpen className="h-10 w-10" />
                    <p className="text-sm">No files yet. Push code using the CLI or upload files manually.</p>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/repo/${resolvedOwner}/${resolvedRepo}`)}>
                      Get Started
                    </Button>
                  </div>
                ) : (
                  <FileExplorer
                    files={files}
                    owner={resolvedOwner}
                    repoName={resolvedRepo}
                    branch={resolvedBranch}
                    basePath={currentPath}
                    currentPath={currentPath}
                  />
                )}
              </div>

              {/* README rendering */}
              {readmeContent && (
                <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm mb-8">
                  <div className="bg-muted/40 px-4 py-3 border-b border-border/60 flex items-center gap-2 font-semibold text-sm">
                    📝 README.md
                  </div>
                  <div className="p-8">
                    <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{readmeContent}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default TreePage;
