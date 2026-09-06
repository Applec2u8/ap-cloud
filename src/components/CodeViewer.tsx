import React, { useMemo } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RepoFile } from './FileExplorer';

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    json: 'json', md: 'markdown', html: 'html', css: 'css',
    scss: 'scss', svg: 'xml', sh: 'bash', yml: 'yaml', yaml: 'yaml',
    toml: 'toml', sql: 'sql', py: 'python', rs: 'rust', go: 'go',
    java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp', php: 'php',
    rb: 'ruby', swift: 'swift', kt: 'kotlin',
  };
  return map[ext] ?? 'text';
}

function isBinary(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svg',
    'woff', 'woff2', 'ttf', 'eot', 'zip', 'tar', 'gz'].includes(ext);
}

function isImage(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp'].includes(ext);
}

interface CodeViewerProps {
  file: RepoFile;
  onClose: () => void;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ file, onClose }) => {
  const [copied, setCopied] = useState(false);
  const filename = file.path.split('/').pop() ?? file.path;
  const lang = getLanguage(filename);
  const binary = isBinary(filename);
  const image = isImage(filename);

  const content = useMemo(() => {
    if (binary) return null;
    try {
      return new TextDecoder('utf-8').decode(file.content);
    } catch {
      return '(Unable to decode file content)';
    }
  }, [file.content, binary]);

  const imageUrl = useMemo(() => {
    if (!image) return null;
    const blob = new Blob([file.content.buffer as ArrayBuffer]);
    return URL.createObjectURL(blob);
  }, [file.content, image]);

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-5xl max-h-[90vh] rounded-2xl border border-border/60 bg-[#0d1117] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[#161b22] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-mono text-[#7ee787] truncate">{file.path}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              ({(file.content.length / 1024).toFixed(1)} KB)
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {!binary && (
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                  copied
                    ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                    : 'bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-white/10'
                }`}
              >
                {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {image && imageUrl ? (
            <div className="flex items-center justify-center p-8 min-h-48">
              <img src={imageUrl} alt={filename} className="max-w-full max-h-[70vh] rounded-lg object-contain" />
            </div>
          ) : binary ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
              Binary file — preview not available.
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
              lineNumberStyle={{ color: '#484f58', userSelect: 'none', minWidth: '3em' }}
            >
              {content ?? ''}
            </SyntaxHighlighter>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeViewer;
