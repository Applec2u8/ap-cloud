import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useRepo } from '../context/RepoContext';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '../supabaseClient';
import {
  ArrowLeft, Settings, Globe, Lock, Save, Trash2,
  AlertTriangle, Check, Loader2, AlertCircle, Tag, Code,
  Link as LinkIcon,
} from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { owner, repoName } = useParams();
  const resolvedOwner = owner ?? 'ap-cloud';
  const resolvedRepo = repoName ?? 'repo';
  const navigate = useNavigate();

  const { repoInfo, loadRepo, setRepoInfo } = useRepo();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  // ── UI state ────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  // ── Load repo if not in context ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      let repo = repoInfo;
      if (!repo || repo.name !== resolvedRepo) {
        setLoading(true);
        repo = await loadRepo(resolvedRepo);
        setLoading(false);
      }
      if (repo) {
        setName(repo.name);
        setDescription(repo.description ?? '');
        setVisibility(repo.visibility ?? 'public');
      }
    })();
  }, [resolvedRepo]);

  // ── Save handler ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!repoInfo) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveError('Repository name cannot be empty.');
      setSaving(false);
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedName)) {
      setSaveError('Name may only contain letters, numbers, hyphens, underscores, and dots.');
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('repositories')
        .update({
          name: trimmedName,
          description: description.trim() || null,
          visibility,
          updated_at: new Date().toISOString(),
        })
        .eq('id', repoInfo.id);

      if (error) throw error;

      // Optimistically update context
      setRepoInfo(prev => prev ? { ...prev, name: trimmedName, description: description.trim() || null, visibility } : prev);
      setSaveSuccess(true);

      // If name changed, redirect to new URL
      if (trimmedName !== resolvedRepo) {
        setTimeout(() => {
          navigate(`/repo/${resolvedOwner}/${trimmedName}/settings`, { replace: true });
        }, 800);
      }
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete handler ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!repoInfo) return;
    if (deleteConfirm !== repoInfo.name) {
      setDeleteError('Repository name does not match. Please type it exactly.');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      // Delete all storage objects for this repo
      const { data: objects } = await supabase.storage
        .from('repo-storage')
        .list(repoInfo.id);
      if (objects && objects.length > 0) {
        await supabase.storage
          .from('repo-storage')
          .remove(objects.map(o => `${repoInfo.id}/${o.name}`));
      }
      // Delete DB record (cascades to commits)
      const { error } = await supabase.from('repositories').delete().eq('id', repoInfo.id);
      if (error) throw error;
      navigate('/cloud-admin', { replace: true });
    } catch (err: any) {
      setDeleteError(err.message ?? 'Failed to delete repository.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-lg shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Link to="/" className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-sm shadow-sm flex-shrink-0">☁️</Link>
            <div className="text-xs sm:text-sm font-semibold flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
              <Link to="#" className="text-blue-500 hover:underline shrink-0 max-w-[70px] sm:max-w-[120px] truncate">{resolvedOwner}</Link>
              <span className="text-muted-foreground shrink-0">/</span>
              <Link to={`/repo/${resolvedOwner}/${resolvedRepo}`} className="font-bold hover:underline truncate max-w-[110px] sm:max-w-[200px] md:max-w-none">{resolvedRepo}</Link>
              <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider shrink-0 px-1.5 py-0">
                {visibility === 'private' ? <><Lock className="h-2.5 w-2.5 mr-1 inline" />Private</> : <>Public</>}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <ThemeSwitcher />
            <Button variant="secondary" size="sm" asChild>
              <Link to={`/repo/${resolvedOwner}/${resolvedRepo}`} className="h-8 gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-4">
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="hidden md:inline">Back to Repo</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Repo tab bar */}
        <div className="mx-auto max-w-6xl px-3 sm:px-6 flex gap-1 border-t border-border/40 overflow-x-auto no-scrollbar flex-nowrap">
          {[
            { label: 'Code', to: `/repo/${resolvedOwner}/${resolvedRepo}`, active: false, icon: <Code className="h-3.5 w-3.5" /> },
            { label: 'Releases', to: `/repo/${resolvedOwner}/${resolvedRepo}/releases`, active: false, icon: <Tag className="h-3.5 w-3.5" /> },
            { label: 'Links', to: `/repo/${resolvedOwner}/${resolvedRepo}/links`, active: false, icon: <LinkIcon className="h-3.5 w-3.5" /> },
            { label: 'Settings', to: `/repo/${resolvedOwner}/${resolvedRepo}/settings`, active: true, icon: <Settings className="h-3.5 w-3.5" /> },
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

      <main className="flex-1 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-8">

          {/* ── General Settings ─────────────────────────────────────────── */}
          <section className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <div className="bg-muted/40 px-6 py-4 border-b border-border/60">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4" /> General
              </h2>
            </div>
            <div className="p-6 space-y-5">

              {/* Name */}
              <div>
                <label htmlFor="repo-name" className="block text-sm font-medium mb-1.5">
                  Repository name
                </label>
                <input
                  id="repo-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-lg border border-border/60 bg-muted/30 px-3.5 py-2.5 text-sm font-mono
                    focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-all"
                  placeholder="repository-name"
                  maxLength={100}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Only letters, numbers, hyphens, underscores and dots.
                </p>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="repo-desc" className="block text-sm font-medium mb-1.5">
                  Description <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  id="repo-desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border/60 bg-muted/30 px-3.5 py-2.5 text-sm resize-none
                    focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-all"
                  placeholder="A short description of this repository…"
                  maxLength={256}
                />
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium mb-2">Visibility</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['public', 'private'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVisibility(v)}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 sm:p-4 text-left transition-all w-full
                        ${visibility === v
                          ? v === 'public'
                            ? 'border-blue-500/60 bg-blue-500/10 ring-1 ring-blue-500/30'
                            : 'border-orange-500/60 bg-orange-500/10 ring-1 ring-orange-500/30'
                          : 'border-border/60 hover:border-border hover:bg-muted/20'}`}
                    >
                      <div className={`mt-0.5 flex-shrink-0 ${visibility === v ? (v === 'public' ? 'text-blue-400' : 'text-orange-400') : 'text-muted-foreground'}`}>
                        {v === 'public' ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold capitalize leading-tight">{v}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed break-words">
                          {v === 'public'
                            ? 'Anyone can see this repository.'
                            : 'Only you and collaborators can see this repository.'}
                        </p>
                      </div>
                      {visibility === v && (
                        <div className="ml-1 flex-shrink-0 mt-0.5">
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center ${v === 'public' ? 'bg-blue-500' : 'bg-orange-500'}`}>
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save feedback */}
              {saveError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {saveError}
                </div>
              )}
              {saveSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                  <Check className="h-4 w-4 flex-shrink-0" /> Settings saved successfully.
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button
                  id="save-settings-btn"
                  onClick={handleSave}
                  disabled={saving}
                  className="h-9 gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save changes
                </Button>
              </div>
            </div>
          </section>

          {/* ── Danger Zone ──────────────────────────────────────────────── */}
          <section className="rounded-xl border border-red-500/30 bg-card overflow-hidden shadow-sm">
            <div className="bg-red-500/8 px-6 py-4 border-b border-red-500/20">
              <h2 className="text-base font-semibold text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Danger Zone
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-medium">Delete this repository</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Once deleted, it cannot be recovered. All commits and files will be permanently removed.
                  </p>
                </div>
                <Button
                  id="open-delete-zone-btn"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 flex-shrink-0"
                  onClick={() => setShowDeleteZone(d => !d)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete repository
                </Button>
              </div>

              {/* Confirm delete panel */}
              {showDeleteZone && (
                <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/5 p-5 space-y-4">
                  <p className="text-sm text-red-400 font-medium">
                    This action is <strong>irreversible</strong>. Type the repository name to confirm:
                  </p>
                  <code className="block text-sm bg-muted/40 rounded-md px-3 py-2 font-mono text-foreground border border-border/40">
                    {repoInfo?.name ?? resolvedRepo}
                  </code>
                  <input
                    id="delete-confirm-input"
                    type="text"
                    value={deleteConfirm}
                    onChange={e => { setDeleteConfirm(e.target.value); setDeleteError(null); }}
                    placeholder="Type repository name here"
                    className="w-full rounded-lg border border-border/60 bg-background px-3.5 py-2.5 text-sm font-mono
                      focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/60 transition-all"
                  />
                  {deleteError && (
                    <div className="flex items-center gap-2 text-sm text-red-400">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" /> {deleteError}
                    </div>
                  )}
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => { setShowDeleteZone(false); setDeleteConfirm(''); setDeleteError(null); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      id="confirm-delete-btn"
                      size="sm"
                      className="h-9 gap-2 bg-red-600 hover:bg-red-700 text-white"
                      disabled={deleting || deleteConfirm !== (repoInfo?.name ?? resolvedRepo)}
                      onClick={handleDelete}
                    >
                      {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : <><Trash2 className="h-4 w-4" /> I understand, delete</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
