import React, { useState } from 'react';
import { Terminal, Copy, Check, GitBranch, Link } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  id: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ text, id }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      id={id}
      onClick={handleCopy}
      title="Copy to clipboard"
      className={`flex items-center justify-center rounded-md p-1.5 transition-all ${
        copied
          ? 'text-green-400 bg-green-400/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      }`}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
};

interface CommandBlockProps {
  id: string;
  command: string;
}

const CommandBlock: React.FC<CommandBlockProps> = ({ id, command }) => (
  <div className="flex items-center justify-between gap-4 rounded-lg bg-[#0d1117] border border-white/8 px-4 py-3 font-mono text-sm group">
    <span className="text-[#7ee787] select-all">{command}</span>
    <CopyButton text={command} id={id} />
  </div>
);

interface QuickSetupProps {
  owner: string;
  repoName: string;
}

const QuickSetup: React.FC<QuickSetupProps> = ({ owner, repoName }) => {
  const repoUrl = `${window.location.origin}/repo/${owner}/${repoName}`;
  const [urlCopied, setUrlCopied] = useState(false);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(repoUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  const commands = {
    init: `npx ap-cloud init --repo ${repoUrl}`,
    push: `npx ap-cloud push -m "Initial commit"`,
    link: `npx ap-cloud link --repo ${repoUrl}`,
  };

  return (
    <div className="mb-8 rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-muted/40 px-5 py-3.5 border-b border-border/60 flex items-center gap-2.5">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-sm">Quick setup</span>
        <span className="text-muted-foreground text-xs">— get started with the ap-cloud CLI</span>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Repository Endpoint URL */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Link className="h-3.5 w-3.5" />
            Repository Endpoint URL
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-[#0d1117] px-4 py-3">
            <span className="flex-1 font-mono text-sm text-blue-400 select-all truncate">{repoUrl}</span>
            <button
              id="copy-repo-url-btn"
              onClick={handleCopyUrl}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                urlCopied
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60'
              }`}
            >
              {urlCopied ? (
                <><Check className="h-3.5 w-3.5" /> Copied!</>
              ) : (
                <><Copy className="h-3.5 w-3.5" /> Copy</>
              )}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-border/40" />
          <span className="text-xs text-muted-foreground font-medium">or set up using the CLI</span>
          <div className="flex-1 border-t border-border/40" />
        </div>

        {/* Setup Options Grid */}
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Initialize a new repo */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold">1</div>
              <p className="text-sm font-semibold">Initialize a new repository</p>
            </div>
            <p className="text-xs text-muted-foreground ml-7">
              Run this in your project directory to connect it to this repository.
            </p>
            <div className="ml-7">
              <CommandBlock id="cmd-init" command={commands.init} />
            </div>
          </div>

          {/* Link an existing repo */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold">↗</div>
              <p className="text-sm font-semibold">Link an existing project</p>
            </div>
            <p className="text-xs text-muted-foreground ml-7">
              Already have a project? Link it to this repository directly.
            </p>
            <div className="ml-7">
              <CommandBlock id="cmd-link" command={commands.link} />
            </div>
          </div>
        </div>

        {/* Push step */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold">2</div>
            <p className="text-sm font-semibold">Push your source code</p>
          </div>
          <p className="text-xs text-muted-foreground ml-7">
            Uploads your project (automatically ignoring <code className="bg-muted px-1 py-0.5 rounded text-foreground">node_modules</code>, <code className="bg-muted px-1 py-0.5 rounded text-foreground">dist</code>, and <code className="bg-muted px-1 py-0.5 rounded text-foreground">.git</code> directories).
          </p>
          <div className="ml-7">
            <CommandBlock id="cmd-push" command={commands.push} />
          </div>
        </div>

        {/* Info footer */}
        <div className="rounded-lg border border-blue-500/15 bg-blue-500/5 px-4 py-3 flex gap-3 items-start">
          <GitBranch className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Don't have the CLI installed?{' '}
            <code className="text-foreground bg-muted px-1.5 py-0.5 rounded font-mono">npx ap-cloud</code>{' '}
            will automatically download and run the latest version.
            You can also install it globally with{' '}
            <code className="text-foreground bg-muted px-1.5 py-0.5 rounded font-mono">npm install -g ap-cloud</code>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuickSetup;
