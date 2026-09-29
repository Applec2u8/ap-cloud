import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, FolderOpen, ChevronRight, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import type { RepoFile } from '../context/RepoContext';
import type { VisibilityMap } from '../hooks/useFileVisibility';
import { getEffectiveVisibility } from '../hooks/useFileVisibility';

// ── File icon map ─────────────────────────────────────────────────────
const FILE_ICON_MAP: Record<string, string> = {
  ts: '🔷', tsx: '🔷', js: '🟨', jsx: '🟨',
  json: '📋', md: '📝', html: '🌐', css: '🎨',
  scss: '🎨', svg: '🖼️', png: '🖼️', jpg: '🖼️',
  jpeg: '🖼️', gif: '🖼️', webp: '🖼️',
  env: '🔒', gitignore: '🚫', sql: '🗄️',
  sh: '⚙️', yml: '⚙️', yaml: '⚙️', toml: '⚙️',
  lock: '🔒', zip: '📦', txt: '📄', rs: '🦀',
  py: '🐍', go: '🐹', rb: '💎', php: '🐘',
  java: '☕', kt: '🎯', swift: '🍎', c: '🔵', cpp: '🔵',
};

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return FILE_ICON_MAP[ext] ?? '📄';
}

// ── Tree building ──────────────────────────────────────────────────────
export interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: TreeNode[];
}

function buildTree(files: RepoFile[], basePath: string): TreeNode[] {
  const root: TreeNode = { name: '', fullPath: '', isDir: true, children: [] };

  const relevant = basePath
    ? files.filter(f => f.path.startsWith(basePath + '/') || f.path.startsWith(basePath === '' ? '' : basePath))
    : files;

  for (const file of relevant) {
    const relativePath = basePath ? file.path.slice(basePath.length + 1) : file.path;
    if (!relativePath) continue;

    const parts = relativePath.split('/');
    let node = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      const isLast = i === parts.length - 1;
      const fullPath = basePath
        ? basePath + '/' + parts.slice(0, i + 1).join('/')
        : parts.slice(0, i + 1).join('/');

      let child = node.children.find(c => c.name === part);
      if (!child) {
        child = { name: part, fullPath, isDir: !isLast, children: [] };
        node.children.push(child);
      }
      if (!isLast) node = child;
    }
  }

  const sort = (nodes: TreeNode[]): TreeNode[] =>
    [...nodes]
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map(n => ({ ...n, children: sort(n.children) }));

  return sort(root.children);
}

// ── Visibility Toggle Button ─────────────────────────────────────────────────
interface VisibilityToggleProps {
  path: string;
  visibilityMap: VisibilityMap;
  onToggle: (path: string, isPublic: boolean) => void;
  saving: boolean;
}

const VisibilityToggle: React.FC<VisibilityToggleProps> = ({ path, visibilityMap, onToggle, saving }) => {
  const effectivePublic = getEffectiveVisibility(path, visibilityMap);
  const selfPublic = path in visibilityMap ? visibilityMap[path] : true;

  const parts = path.split('/');
  let ancestorPrivate = false;
  for (let i = 1; i < parts.length; i++) {
    const ancestor = parts.slice(0, i).join('/');
    if (ancestor in visibilityMap && visibilityMap[ancestor] === false) {
      ancestorPrivate = true;
      break;
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!saving) onToggle(path, !selfPublic);
  };

  return (
    <button
      onClick={handleClick}
      title={
        ancestorPrivate
          ? 'Parent folder is private — make it public first'
          : effectivePublic ? 'Make Private' : 'Make Public'
      }
      disabled={saving || ancestorPrivate}
      className={`
        flex-shrink-0 flex items-center gap-0.5 px-1 py-px rounded text-[9px] font-bold
        transition-all duration-150 select-none border leading-none
        ${saving ? 'opacity-50 cursor-wait' : ancestorPrivate ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'}
        ${effectivePublic
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
          : 'bg-orange-500/10 text-orange-400 border-orange-500/25 hover:bg-orange-500/20'
        }
      `}
    >
      {saving
        ? <Loader2 className="h-2 w-2 animate-spin" />
        : effectivePublic
          ? <Eye className="h-2 w-2" />
          : <EyeOff className="h-2 w-2" />
      }
      <span>{effectivePublic ? 'Pub' : 'Priv'}</span>
    </button>
  );
};

// ── TreeRow (recursive) ──────────────────────────────────────────────────
interface TreeRowProps {
  node: TreeNode;
  depth: number;
  owner: string;
  repoName: string;
  branch: string;
  currentPath: string;
  isAdmin: boolean;
  visibilityMap: VisibilityMap;
  savingPaths: Set<string>;
  onToggleVisibility: (path: string, isPublic: boolean) => void;
}

const TreeRow: React.FC<TreeRowProps> = ({
  node, depth, owner, repoName, branch, currentPath,
  isAdmin, visibilityMap, savingPaths, onToggleVisibility,
}) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const effectivePublic = useMemo(
    () => getEffectiveVisibility(node.fullPath, visibilityMap),
    [node.fullPath, visibilityMap],
  );

  const handleFolderClick = () => setOpen(o => !o);

  // Non-admin clicking a private file: block navigation
  const handleFileClick = () => {
    if (!isAdmin && !effectivePublic) return; // blocked
    navigate(`/repo/${owner}/${repoName}/blob/${branch}/${node.fullPath}`);
  };

  const isActive = currentPath === node.fullPath;
  const folderPadding = 12 + depth * 20;
  const filePadding   = 12 + depth * 20 + 20;
  const saving = savingPaths.has(node.fullPath);
  const isPrivateForUser = !isAdmin && !effectivePublic;

  const childProps = {
    depth: depth + 1, owner, repoName, branch, currentPath,
    isAdmin, visibilityMap, savingPaths, onToggleVisibility,
  };

  if (node.isDir) {
    // Always show total children to admin; for users show all (including dimmed private)
    const totalChildCount = node.children.length;

    return (
      <div>
        <div
          className={`w-full flex items-center gap-1.5 py-[5px] text-sm transition-colors group text-left select-none rounded-sm
            ${isPrivateForUser ? 'opacity-30' : (!effectivePublic && isAdmin ? 'opacity-60' : '')}
            ${isActive ? 'bg-blue-500/15 text-blue-400' : 'hover:bg-muted/50'}`}
          style={{ paddingLeft: `${folderPadding}px`, paddingRight: '8px' }}
        >
          {/* Expand/collapse button — always allowed (even private folders are explorable) */}
          <button
            className="flex items-center gap-1.5 min-w-0 flex-1"
            onClick={handleFolderClick}
            aria-expanded={open}
          >
            <ChevronRight
              className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform duration-200"
              style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
            {open
              ? <FolderOpen className="h-4 w-4 text-blue-400 flex-shrink-0" />
              : <Folder className="h-4 w-4 text-blue-400 fill-blue-400/20 flex-shrink-0" />}
            <span className={`font-medium truncate transition-colors ${isActive ? '' : 'group-hover:text-blue-300'}`}>
              {node.name}
            </span>
            {/* Private lock icon for non-admins */}
            {isPrivateForUser && <Lock className="h-3 w-3 text-orange-400/70 flex-shrink-0 ml-1" />}
          </button>

          {/* Right-side: item count badge + admin toggle */}
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
            {totalChildCount > 0 && (
              <span className="text-[9px] text-muted-foreground/60 font-mono bg-muted/50 border border-border/40 px-1 py-px rounded-full leading-none">
                {totalChildCount}
              </span>
            )}
            {isAdmin && (
              <VisibilityToggle
                path={node.fullPath}
                visibilityMap={visibilityMap}
                onToggle={onToggleVisibility}
                saving={saving}
              />
            )}
          </div>
        </div>

        {/* Smooth expand animation */}
        <div
          className="grid transition-all duration-200 ease-in-out"
          style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div
              className="border-l border-border/30"
              style={{ marginLeft: `${folderPadding + 7}px` }}
            >
              {node.children.map(child => (
                <TreeRow key={child.fullPath} node={child} {...childProps} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── File row ──
  return (
    <div
      className={`w-full flex items-center gap-1.5 py-[5px] text-sm transition-colors group text-left select-none rounded-sm
        ${isPrivateForUser ? 'opacity-30' : (!effectivePublic && isAdmin ? 'opacity-60' : '')}
        ${isActive ? 'bg-blue-500/15 text-blue-400' : 'hover:bg-muted/50 text-foreground/90'}`}
      style={{ paddingLeft: `${filePadding}px`, paddingRight: '8px' }}
    >
      <button
        className={`flex items-center gap-2 min-w-0 flex-1 ${isPrivateForUser ? 'cursor-not-allowed' : ''}`}
        onClick={handleFileClick}
        title={isPrivateForUser ? 'This file is private' : undefined}
      >
        <span className="text-[13px] flex-shrink-0 leading-none">{fileIcon(node.name)}</span>
        <span className={`truncate transition-colors ${isActive ? '' : (!isPrivateForUser ? 'group-hover:text-blue-300' : '')}`}>
          {node.name}
        </span>
        {isPrivateForUser && <Lock className="h-3 w-3 text-orange-400/70 flex-shrink-0 ml-1" />}
      </button>

      {isAdmin && (
        <div className="flex-shrink-0 ml-1">
          <VisibilityToggle
            path={node.fullPath}
            visibilityMap={visibilityMap}
            onToggle={onToggleVisibility}
            saving={saving}
          />
        </div>
      )}
    </div>
  );
};

// ── FileExplorer (top-level) ────────────────────────────────────────────
interface FileExplorerProps {
  files: RepoFile[];
  owner: string;
  repoName: string;
  branch: string;
  basePath?: string;
  currentPath?: string;
  isAdmin?: boolean;
  visibilityMap?: VisibilityMap;
  onToggleVisibility?: (path: string, isPublic: boolean) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files, owner, repoName, branch,
  basePath = '', currentPath = '',
  isAdmin = false,
  visibilityMap = {},
  onToggleVisibility,
}) => {
  const tree = useMemo(() => buildTree(files, basePath), [files, basePath]);

  const [savingPaths, setSavingPaths] = useState<Set<string>>(new Set());

  const handleToggle = useCallback(async (path: string, isPublic: boolean) => {
    if (!onToggleVisibility) return;
    setSavingPaths(prev => new Set(prev).add(path));
    try {
      await onToggleVisibility(path, isPublic);
    } finally {
      setSavingPaths(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }, [onToggleVisibility]);

  if (tree.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        No files in this directory.
      </div>
    );
  }

  const rowProps = {
    owner, repoName, branch, currentPath,
    isAdmin, visibilityMap, savingPaths,
    onToggleVisibility: handleToggle,
  };

  return (
    <div className="py-1">
      {tree.map(node => (
        <TreeRow
          key={node.fullPath}
          node={node}
          depth={0}
          {...rowProps}
        />
      ))}
    </div>
  );
};

export default FileExplorer;
export type { RepoFile };
