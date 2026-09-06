import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbsProps {
  owner: string;
  repoName: string;
  branch: string;
  path: string; // e.g. "src/components/Button.tsx"
  isFile?: boolean;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ owner, repoName, branch, path, isFile }) => {
  const navigate = useNavigate();
  const parts = path ? path.split('/').filter(Boolean) : [];

  const goTo = (index: number) => {
    if (index < 0) {
      navigate(`/repo/${owner}/${repoName}`);
      return;
    }
    const targetPath = parts.slice(0, index + 1).join('/');
    const isLastPart = index === parts.length - 1;
    // If it's the last part AND this is a file view, stay as blob; otherwise go tree
    if (isFile && isLastPart) return; // already here
    navigate(`/repo/${owner}/${repoName}/tree/${branch}/${targetPath}`);
  };

  return (
    <nav className="flex items-center gap-1 text-sm flex-wrap min-w-0" aria-label="breadcrumb">
      {/* Root */}
      <button
        onClick={() => goTo(-1)}
        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline underline-offset-2 transition-colors font-semibold flex-shrink-0"
      >
        <Home className="h-3.5 w-3.5" />
        {repoName}
      </button>

      {parts.map((part, idx) => {
        const isLast = idx === parts.length - 1;
        return (
          <React.Fragment key={idx}>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            {isLast ? (
              <span className="font-semibold text-foreground truncate">{part}</span>
            ) : (
              <button
                onClick={() => goTo(idx)}
                className="text-blue-400 hover:text-blue-300 hover:underline underline-offset-2 transition-colors truncate"
              >
                {part}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
