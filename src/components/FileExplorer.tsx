import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import type { RepoFile } from '../context/RepoContext';

// ── File icon map ─────────────────────────────────────────────────────────────
const FILE_ICON_MAP: Record<string, string> = {
  ts: '🔷', tsx: '🔷', js: '🟨', jsx: '🟨',
  json: '📋', md: '📝', html: '🌐', css: '🎨',
  scss: '🎨', svg: '🖼️', png: '🖼️', jpg: '🖼️',
  gif: '🖼️', env: '🔒', gitignore: '🚫', sql: '🗄️',
  sh: '⚙️', yml: '⚙️', yaml: '⚙️', toml: '⚙️',
  lock: '🔒', zip: '📦', txt: '📄',
};

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return FILE_ICON_MAP[ext] ?? '📄';
}

// ── Tree building ─────────────────────────────────────────────────────────────
interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: TreeNode[];
}

function buildTree(files: RepoFile[], basePath: string): TreeNode[] {
  const root: TreeNode = { name: '', fullPath: '', isDir: true, children: [] };

  // Only include files that are under basePath
  const relevant = basePath
    ? files.filter(f => f.path.startsWith(basePath + '/') || f.path.startsWith(basePath === '' ? '' : basePath))
    : files;

  for (const file of relevant) {
    // Compute path relative to basePath
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

// ── TreeRow (recursive) ───────────────────────────────────────────────────────
interface TreeRowProps {
  node: TreeNode;
  depth: number;
  owner: string;
  repoName: string;
  branch: string;
  currentPath: string;
}

const TreeRow: React.FC<TreeRowProps> = ({ node, depth, owner, repoName, branch, currentPath }) => {
  const [open, setOpen] = useState(false); // collapsed by default
  const navigate = useNavigate();

  const handleClick = () => {
    if (node.isDir) {
      setOpen(o => !o);
      // Also navigate to the tree path
      navigate(`/repo/${owner}/${repoName}/tree/${branch}/${node.fullPath}`);
    } else {
      navigate(`/repo/${owner}/${repoName}/blob/${branch}/${node.fullPath}`);
    }
  };

  const isActive = currentPath === node.fullPath;

  if (node.isDir) {
    return (
      <>
        <button
          className={`w-full flex items-center gap-2 py-2 text-sm transition-colors group text-left
            ${isActive ? 'bg-blue-500/10 text-blue-400' : 'hover:bg-muted/40'}`}
          style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
          onClick={handleClick}
        >
          <span className="flex-shrink-0 text-muted-foreground">
            {open
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
          {open
            ? <FolderOpen className="h-4 w-4 text-blue-400 flex-shrink-0" />
            : <Folder className="h-4 w-4 text-blue-400 fill-blue-400/20 flex-shrink-0" />}
          <span className="font-medium truncate group-hover:text-blue-400 transition-colors">
            {node.name}
          </span>
        </button>

        {/* Smooth expand animation */}
        <div
          className="overflow-hidden transition-all duration-200 ease-in-out"
          style={{ maxHeight: open ? `${node.children.length * 400}px` : '0px' }}
        >
          {node.children.map(child => (
            <TreeRow
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              owner={owner}
              repoName={repoName}
              branch={branch}
              currentPath={currentPath}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <button
      className={`w-full flex items-center gap-2 py-2 text-sm transition-colors group text-left
        ${isActive ? 'bg-blue-500/10 text-blue-400' : 'hover:bg-muted/40'}`}
      style={{ paddingLeft: `${16 + depth * 16 + 20}px`, paddingRight: '16px' }}
      onClick={handleClick}
    >
      <span className="text-[13px] flex-shrink-0">{fileIcon(node.name)}</span>
      <span className="truncate group-hover:text-blue-400 transition-colors">{node.name}</span>
    </button>
  );
};

// ── FileExplorer (top-level) ──────────────────────────────────────────────────
interface FileExplorerProps {
  files: RepoFile[];
  owner: string;
  repoName: string;
  branch: string;
  basePath?: string;    // current directory we're showing
  currentPath?: string; // highlighted active path
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files, owner, repoName, branch, basePath = '', currentPath = '',
}) => {
  const tree = useMemo(() => buildTree(files, basePath), [files, basePath]);

  if (tree.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        No files in this directory.
      </div>
    );
  }

  return (
    <div>
      {tree.map(node => (
        <TreeRow
          key={node.fullPath}
          node={node}
          depth={0}
          owner={owner}
          repoName={repoName}
          branch={branch}
          currentPath={currentPath}
        />
      ))}
    </div>
  );
};

export default FileExplorer;
export type { RepoFile };
