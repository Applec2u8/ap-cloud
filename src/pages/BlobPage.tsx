import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useRepo } from '../context/RepoContext';
import Breadcrumbs from '../components/Breadcrumbs';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  ArrowLeft, Copy, Check, Loader2, AlertCircle, Download, FileText,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

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

  const {
    repoInfo, commits, files, activeCommit,
    loadingRepo, loadingFiles, repoError,
    loadRepo, loadCommits, loadFiles,
  } = useRepo();

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

  const handleDownload = async () => {
    if (!repoInfo || !activeCommit) return;
    const path = `${repoInfo.id}/${activeCommit.commit_hash}/source.zip`;
    const { data } = await supabase.storage.from('repo-storage').createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

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
                    <Download className="h-3.5 w-3.5" /> Download ZIP
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
                  lineNumberStyle={{ color: '#484f58', userSelect: 'none', minWidth: '3.5em' }}
                >
                  {content}
                </SyntaxHighlighter>
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
