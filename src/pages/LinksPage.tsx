import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRepo } from '../context/RepoContext';
import { supabaseUrl } from '../supabaseClient';
import ThemeSwitcher from '../components/ThemeSwitcher';
import LinkAliasesManager from '../components/LinkAliasesManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Tag, Settings, Link as LinkIcon, Loader2, Code,
} from 'lucide-react';

const LinksPage: React.FC = () => {
  const { owner, repoName } = useParams();
  const resolvedOwner = owner ?? 'ap-cloud';
  const resolvedRepo = repoName ?? 'repo';

  const { repoInfo, loadRepo } = useRepo();

  // Load repo into context if not already present
  useEffect(() => {
    (async () => {
      if (!repoInfo || repoInfo.name !== resolvedRepo) {
        await loadRepo(resolvedRepo);
      }
    })();
  }, [resolvedRepo]);

  const edgeFunctionUrl = repoInfo
    ? `${supabaseUrl}/functions/v1/latest-version?repo_id=${repoInfo.id}`
    : `${supabaseUrl}/functions/v1/latest-version`;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-lg shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Link
              to="/"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-sm shadow-sm flex-shrink-0"
            >
              ☁️
            </Link>
            <div className="text-xs sm:text-sm font-semibold flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
              <Link to="#" className="text-blue-500 hover:underline shrink-0 max-w-[70px] sm:max-w-[120px] truncate">
                {resolvedOwner}
              </Link>
              <span className="text-muted-foreground shrink-0">/</span>
              <Link
                to={`/repo/${resolvedOwner}/${resolvedRepo}`}
                className="font-bold hover:underline truncate max-w-[110px] sm:max-w-[200px] md:max-w-none"
              >
                {resolvedRepo}
              </Link>
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
            { label: 'Code', to: `/repo/${resolvedOwner}/${resolvedRepo}`, icon: <Code className="h-3.5 w-3.5" />, active: false },
            { label: 'Releases', to: `/repo/${resolvedOwner}/${resolvedRepo}/releases`, icon: <Tag className="h-3.5 w-3.5" />, active: false },
            { label: 'Links', to: `/repo/${resolvedOwner}/${resolvedRepo}/links`, icon: <LinkIcon className="h-3.5 w-3.5" />, active: true },
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

      {/* ── Main ── */}
      <main className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl">

          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-blue-500" />
              Link Aliases
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Permanent proxy URLs for <strong>{resolvedRepo}</strong>. Embed these in your client apps
              — they never change even when the underlying release URL does.
            </p>
          </div>

          {/* Content */}
          {!repoInfo ? (
            <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Loading repository…</span>
            </div>
          ) : (
            <LinkAliasesManager
              repoId={repoInfo.id}
              edgeFunctionUrl={edgeFunctionUrl}
            />
          )}

        </div>
      </main>

      {/* ── Footer ── */}
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

export default LinksPage;
