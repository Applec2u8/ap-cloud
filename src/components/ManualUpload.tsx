import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, X, CheckCircle, Loader2, FolderArchive, FileText, HelpCircle, GitCommit, MessageSquare, Copy, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ignore from 'ignore';
import { zip } from 'fflate';
import { supabase } from '../supabaseClient';
import { Progress } from '@/components/ui/progress';

interface ManualUploadProps {
  owner: string;
  repoName: string;
  onUploadSuccess?: () => void;
}

interface CommitResult {
  commitHash: string;
  message: string;
  fileCount: number;
}

const DEFAULT_IGNORES = ['node_modules', 'dist', '.git', '.next', '*.lock', 'package-lock.json'];

// Generates a short git-like hash
function generateCommitHash(): string {
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 7);
}

// ── ap-cloud.json Help Modal ──────────────────────────────────────────────────
const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [copiedName, setCopiedName] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const jsonCode = `{
  "ignore": [
    "*.log",
    "*.env",
    "coverage/",
    "build/",
    "dist/",
    ".cache/",
    "*.test.ts",
    "__tests__/",
    ".gitignore",
    ".git/",
    "src/__pycache__/",
    ".venv/",
    "node_modules/",
    ".next/",
    ".svelte-kit/",
    "target/",
    "installer_output"
  ]
}`;

  const copyName = () => {
    navigator.clipboard.writeText('ap-cloud.json');
    setCopiedName(true);
    setTimeout(() => setCopiedName(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(jsonCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/40">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-400" />
            <span className="font-semibold text-sm">ap-cloud.json — Configuration Guide</span>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-muted-foreground leading-relaxed flex items-center flex-wrap gap-1.5">
            Place an 
            <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded font-mono text-xs text-foreground border border-border/40">
              ap-cloud.json
              <button 
                onClick={copyName} 
                className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy filename"
              >
                {copiedName ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </span> 
            file in the <strong className="text-foreground">root</strong> of your project to customize upload behavior.
          </p>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Example</p>
              <button 
                onClick={copyCode}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors bg-muted/50 hover:bg-muted px-2 py-1 rounded-md border border-border/40"
              >
                {copiedCode ? <><Check className="h-3 w-3 text-green-400" /> Copied</> : <><Copy className="h-3 w-3" /> Copy JSON</>}
              </button>
            </div>
            <pre className="rounded-lg bg-[#0d1117] border border-white/8 p-4 text-xs text-[#7ee787] font-mono overflow-x-auto">
              {jsonCode}
            </pre>
          </div>

        <div className="rounded-lg border border-border/40 bg-muted/20 p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold text-foreground">Supported Pattern Types</p>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li><code className="bg-muted px-1 rounded text-foreground">*.log</code> — All files with a specific extension</li>
            <li><code className="bg-muted px-1 rounded text-foreground">build/</code> — An entire directory by name</li>
            <li><code className="bg-muted px-1 rounded text-foreground">.env</code> — A specific file in any directory</li>
            <li><code className="bg-muted px-1 rounded text-foreground">src/**/*.test.ts</code> — Glob patterns</li>
          </ul>
        </div>

        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-muted-foreground">
          <strong className="text-yellow-400">Always excluded by default:</strong>{' '}
          <code className="text-foreground">node_modules</code>, <code className="text-foreground">dist</code>,{' '}
          <code className="text-foreground">.git</code>, <code className="text-foreground">.next</code>
          — even without an <code className="text-foreground">ap-cloud.json</code>.
        </div>
      </div>
    </div>
  </div>
  );
};

// ── Commit Message Modal ──────────────────────────────────────────────────────
const CommitMessageModal: React.FC<{
  fileCount: number;
  onConfirm: (message: string) => void;
  onCancel: () => void;
}> = ({ fileCount, onConfirm, onCancel }) => {
  const [message, setMessage] = useState('Manual web upload');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60 bg-muted/40">
          <GitCommit className="h-4 w-4 text-green-400" />
          <span className="font-semibold text-sm">Commit Details</span>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Ready to upload <strong className="text-foreground">{fileCount} files</strong>. Add a commit message to describe your changes.
          </p>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Commit Message
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-[#0d1117] px-3 py-2.5">
              <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                placeholder="Describe what changed..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && message.trim()) onConfirm(message.trim());
                  if (e.key === 'Escape') onCancel();
                }}
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => onConfirm(message.trim() || 'Manual web upload')}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload & Commit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main ManualUpload Component ───────────────────────────────────────────────
const ManualUpload: React.FC<ManualUploadProps> = ({ repoName, onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CommitResult | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ path: string; file: File }[] | null>(null);
  const [showCommitModal, setShowCommitModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-cleanup if user closes tab while uploading
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploading) {
        e.preventDefault();
        e.returnValue = ''; // Standard way to show "Leave Site?" prompt
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploading]);

  const cleanupOrphanedChunks = async (repoId: string, commitHash: string, chunksUploaded: number) => {
    try {
      const filesToRemove = [];
      for (let i = 0; i < chunksUploaded; i++) {
        filesToRemove.push(`${repoId}/${commitHash}/chunks/part-${i}`);
      }
      if (filesToRemove.length > 0) {
        await supabase.storage.from('repo-storage').remove(filesToRemove);
      }
    } catch (err) {
      console.error('Failed to cleanup chunks:', err);
    }
  };

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const startUpload = async (files: { path: string; file: File }[], commitMessage: string) => {
    let currentRepoId = '';
    let currentCommitHash = '';
    let chunksUploaded = 0;

    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setUploading(true);
      setError(null);
      setProgress(0);
      setStatus('Analyzing files...');

      // 1. Find & parse ap-cloud.json
      const configEntry = files.find(f => f.path === 'ap-cloud.json');
      let customIgnores: string[] = [];
      if (configEntry) {
        try {
          const config = JSON.parse(await configEntry.file.text());
          if (Array.isArray(config.ignore)) customIgnores = config.ignore;
        } catch {
          console.warn('Failed to parse ap-cloud.json');
        }
      }

      // 2. Filter ignored files
      const ig = ignore().add(DEFAULT_IGNORES).add(customIgnores);
      const validFiles = files.filter(f => {
        try { return !ig.ignores(f.path); } catch { return true; }
      });

      if (validFiles.length === 0) throw new Error('No valid files after applying ignore rules.');

      setStatus(`Zipping ${validFiles.length} files...`);

      // 3. Zip in parallel then collect
      const zipInput: Record<string, Uint8Array> = {};
      await Promise.all(
        validFiles.map(async (f) => {
          const buf = await f.file.arrayBuffer();
          zipInput[f.path] = new Uint8Array(buf);
        })
      );

      const zipData = await new Promise<Uint8Array>((resolve, reject) => {
        zip(zipInput, (err, data) => err ? reject(err) : resolve(data));
      });

      // 4. Fetch repo ID
      const { data: repoData, error: repoErr } = await supabase
        .from('repositories').select('id').eq('name', repoName).single();
      if (repoErr || !repoData) throw new Error('Failed to find repository. Make sure it exists in the database.');
      const realRepoId = repoData.id;
      currentRepoId = realRepoId;

      // 5. Generate commit hash
      const commitHash = generateCommitHash();
      currentCommitHash = commitHash;

      // Check abort
      if (abortControllerRef.current?.signal.aborted) throw new Error('Upload cancelled by user');

      // 6. Chunked upload
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
      const totalChunks = Math.ceil(zipData.length / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        if (abortControllerRef.current?.signal.aborted) throw new Error('Upload cancelled by user');

        setStatus(`Uploading chunk ${i + 1} / ${totalChunks}...`);
        const chunk = zipData.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, zipData.length));
        const chunkPath = `${realRepoId}/${commitHash}/chunks/part-${i}`;

        // Convert to Blob to use standard fetch with AbortSignal if supported, or rely on loop-check
        // (Supabase JS doesn't strictly support aborting mid-chunk natively without custom fetch, 
        // but checking the signal before and after helps).
        const { error: uploadErr } = await supabase.storage
          .from('repo-storage')
          .upload(chunkPath, chunk, { contentType: 'application/octet-stream', upsert: true });

        if (uploadErr) throw uploadErr;

        chunksUploaded++;
        setProgress(Math.round(((i + 1) / totalChunks) * 85));
      }

      if (abortControllerRef.current?.signal.aborted) throw new Error('Upload cancelled by user');

      setStatus('Merging chunks on server...');

      // 7. Merge via Edge Function
      const { error: mergeErr } = await supabase.functions.invoke('merge-chunks', {
        body: { repoId: realRepoId, commitHash, totalChunks },
      });
      if (mergeErr) throw mergeErr;

      setProgress(95);
      setStatus('Recording commit...');

      // 8. Record commit in DB
      const { error: commitErr } = await supabase.from('commits').insert({
        repo_id: realRepoId,
        commit_hash: commitHash,
        message: commitMessage,
      });
      if (commitErr) throw commitErr;

      setProgress(100);
      setSuccess({ commitHash, message: commitMessage, fileCount: validFiles.length });
      onUploadSuccess?.();
    } catch (err: any) {
      console.error(err);

      const isCancelled = err.message === 'Upload cancelled by user' || err.name === 'AbortError';
      if (isCancelled) {
        setError('Upload cancelled.');
        setStatus('Cleaning up...');
        if (currentRepoId && currentCommitHash) {
          await cleanupOrphanedChunks(currentRepoId, currentCommitHash, chunksUploaded);
        }
      } else {
        setError(err.message || 'An error occurred during upload.');
      }
    } finally {
      abortControllerRef.current = null;
      setUploading(false);
    }
  };

  const collectFiles = async (items: DataTransferItemList): Promise<{ path: string; file: File }[]> => {
    const files: { path: string; file: File }[] = [];
    const readEntry = async (entry: any, pathPrefix = '') => {
      if (entry.isFile) {
        const file = await new Promise<File>((res) => entry.file(res));
        files.push({ path: pathPrefix + file.name, file });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        let batch: any[] = [];
        // readEntries may return batches; call until empty
        do {
          batch = await new Promise<any[]>((res) => reader.readEntries(res));
          for (const child of batch) await readEntry(child, pathPrefix + entry.name + '/');
        } while (batch.length > 0);
      }
    };
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) await readEntry(entry);
    }
    // Strip single root folder prefix
    if (files.length > 0) {
      const roots = new Set(files.map(f => f.path.split('/')[0]));
      if (roots.size === 1) {
        const prefix = Array.from(roots)[0] + '/';
        files.forEach(f => { f.path = f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path; });
      }
    }
    return files;
  };

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    setError(null);
    setStatus('Reading files...');
    try {
      const files = await collectFiles(e.dataTransfer.items);
      if (files.length === 0) throw new Error('No files found in the dropped folder.');
      setPendingFiles(files);
      setShowCommitModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to read dropped files.');
    }
  }, [uploading]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setError(null);
    const files = Array.from(e.target.files).map(f => {
      const parts = f.webkitRelativePath.split('/');
      return { path: parts.length > 1 ? parts.slice(1).join('/') : f.name, file: f };
    });
    setPendingFiles(files);
    setShowCommitModal(true);
  };

  const handleCommitConfirm = async (message: string) => {
    setShowCommitModal(false);
    if (pendingFiles) await startUpload(pendingFiles, message);
    setPendingFiles(null);
  };

  const handleCommitCancel = () => {
    setShowCommitModal(false);
    setPendingFiles(null);
    setStatus('');
  };

  return (
    <>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showCommitModal && pendingFiles && (
        <CommitMessageModal
          fileCount={pendingFiles.length}
          onConfirm={handleCommitConfirm}
          onCancel={handleCommitCancel}
        />
      )}

      <div className="mb-8 rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <div className="bg-muted/40 px-5 py-3.5 border-b border-border/60 flex items-center gap-2.5">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Manual Web Upload</span>
          <span className="text-muted-foreground text-xs">— upload project files directly</span>
          <button
            onClick={() => setShowHelp(true)}
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1 hover:bg-muted"
          >
            <HelpCircle className="h-3.5 w-3.5" /> ap-cloud.json help
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {success ? (
            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-6 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
              <h3 className="text-lg font-semibold text-green-500 mb-1">Upload Successful!</h3>
              <div className="flex items-center justify-center gap-2 mb-2">
                <GitCommit className="h-4 w-4 text-muted-foreground" />
                <code className="text-sm font-mono text-muted-foreground">{success.commitHash}</code>
              </div>
              <p className="text-sm text-muted-foreground mb-1">"{success.message}"</p>
              <p className="text-xs text-muted-foreground mb-4">{success.fileCount} files uploaded</p>
              <Button variant="outline" onClick={() => { setSuccess(null); setProgress(0); }}>
                Upload Another Version
              </Button>
            </div>
          ) : (
            <>
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-all duration-200
                  ${isDragging ? 'border-blue-500 bg-blue-500/5 scale-[1.01]' : 'border-border/60 hover:border-muted-foreground/50 hover:bg-muted/20'}
                  ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  // @ts-ignore
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleFileInput}
                />
                <div className={`mb-4 rounded-full p-4 transition-colors ${isDragging ? 'bg-blue-500/15' : 'bg-muted'}`}>
                  <FolderArchive className={`h-9 w-9 transition-colors ${isDragging ? 'text-blue-400' : 'text-muted-foreground'}`} />
                </div>
                <h3 className="mb-1.5 text-lg font-semibold">
                  {isDragging ? 'Drop to upload' : 'Click or drag folder to upload'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Automatically skips <code className="bg-muted px-1 py-0.5 rounded text-xs">node_modules</code>,{' '}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">dist</code>, and files specified in your{' '}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">ap-cloud.json</code>
                </p>

                {uploading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm rounded-xl p-6 z-10">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
                    <p className="text-sm font-medium mb-3">{status}</p>
                    <Progress value={progress} className="w-full max-w-xs h-2" />
                    <div className="flex w-full max-w-xs justify-between items-center mt-2">
                      <p className="text-xs text-muted-foreground">{progress}%</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelUpload();
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-start gap-2">
                  <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="rounded-lg border border-blue-500/15 bg-blue-500/5 px-4 py-3 flex gap-3 items-start">
                <FileText className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Large uploads are automatically split into 5 MB chunks and merged on our servers.
                  Each upload creates a new commit entry in the history.
                  Click <button onClick={() => setShowHelp(true)} className="text-blue-400 underline underline-offset-2">ap-cloud.json help</button> to learn about custom ignore rules.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ManualUpload;
