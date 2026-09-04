import React, { useState, useCallback, useEffect } from 'react';
import { supabase, supabaseUrl } from '../supabaseClient';
import type { Release } from '../supabaseClient';
import DropZone from '../components/DropZone';
import ProgressBar from '../components/ProgressBar';
import ReleaseCard from '../components/ReleaseCard';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CloudUpload, Package, LogOut, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string;

// ─── Auth Gate ────────────────────────────────────────────────────────────────
const AuthGate: React.FC<{ onAuth: () => void }> = ({ onAuth }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('ap_cloud_auth', '1');
      onAuth();
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(37,99,235,0.1)_0%,transparent_70%)]" />

      <Card className="relative w-full max-w-[420px] shadow-xl">
        <CardHeader className="items-center pb-2 pt-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-2xl shadow-[0_8px_24px_rgba(37,99,235,0.35)]">
            🔐
          </div>
          <CardTitle className="text-xl">Admin Access</CardTitle>
          <p className="text-sm text-muted-foreground">AP-Cloud — Restricted Area</p>
        </CardHeader>

        <CardContent className="pb-8">
          {error && (
            <Alert variant="error" className="mb-5">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" id="admin-login-btn">
              <ShieldCheck className="h-4 w-4" />
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Admin Panel ──────────────────────────────────────────────────────────────
const AdminPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [appName, setAppName] = useState('');
  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isLatest, setIsLatest] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(true);
  const [updatingVisibilityId, setUpdatingVisibilityId] = useState<string | null>(null);
  const [updatingLatestId, setUpdatingLatestId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const baseUrl = window.location.origin;
  // Edge Function URL (true application/json — preferred for Python clients)
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/latest-version`;

  const showAlert = (type: 'success' | 'error', msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  };

  const fetchReleases = useCallback(async () => {
    setLoadingReleases(true);
    const { data, error } = await supabase
      .from('releases')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setReleases(data as Release[]);
    setLoadingReleases(false);
  }, []);

  const uploadWithProgress = (path: string, uploadFile: File, onProgress: (value: number) => void) => {
    const attempt = (retryCount: number): Promise<void> => new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `${supabaseUrl}/storage/v1/object/updates/${path}`);
      request.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
      request.setRequestHeader('Authorization', `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`);
      request.setRequestHeader('x-upsert', 'false');
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 70));
      };
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) resolve();
        else reject(new Error(request.responseText || `Storage upload failed (${request.status})`));
      };
      request.onerror = () => {
        if (retryCount < 3) window.setTimeout(() => { void attempt(retryCount + 1).then(resolve).catch(reject); }, 1000 * (retryCount + 1));
        else reject(new Error('Network connection lost. Upload could not be completed after 3 retries.'));
      };
      request.send(uploadFile);
    });
    return attempt(0);
  };

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !appName.trim() || !version.trim()) {
      showAlert('error', 'Please fill all fields and select a file.');
      return;
    }

    // Validate version uniqueness
    const existing = releases.find((r) => r.version === version.trim());
    if (existing) {
      showAlert('error', `Version v${version.trim()} already exists. Use a different version number.`);
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const safeName = file.name.replace(/\s+/g, '_');
      const storagePath = `${version.trim()}/${safeName}`;

      // Upload to Supabase Storage
      await uploadWithProgress(storagePath, file, (uploadProgress) => setProgress(10 + uploadProgress));
      setProgress(65);

      // Get public URL
      const { data: urlData } = supabase.storage.from('updates').getPublicUrl(storagePath);
      setProgress(80);

      // Insert into releases table
      const { data: insertedRelease, error: dbError } = await supabase.from('releases').insert({
        app_name: appName.trim(),
        version: version.trim(),
        filename: safeName,
        size: file.size,
        public_url: urlData.publicUrl,
        release_notes: releaseNotes.trim() || null,
        is_public: isPublic,
        is_latest: false,
      }).select('id').single();

      if (dbError) throw dbError;
      if (isLatest) {
        const { error: latestError } = await supabase.rpc('set_latest_release', { target_release_id: insertedRelease.id });
        if (latestError) throw latestError;
      }

      setProgress(100);
      showAlert('success', `✅ v${version.trim()} uploaded successfully!`);

      // Reset form
      setFile(null);
      setAppName('');
      setVersion('');
      setReleaseNotes('');
      setIsPublic(true);
      setIsLatest(false);
      setTimeout(() => setProgress(0), 800);

      fetchReleases();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      showAlert('error', message);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleLatestChange = async (release: Release) => {
    if (release.is_latest) return;
    setUpdatingLatestId(release.id);
    try {
      const { error } = await supabase.rpc('set_latest_release', { target_release_id: release.id });
      if (error) throw new Error(`Could not set latest version: ${error.message}`);
      await fetchReleases();
      showAlert('success', `Release v${release.version} is now the Latest Version.`);
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'Could not set latest version.');
    } finally {
      setUpdatingLatestId(null);
    }
  };

  const handleVisibilityChange = async (release: Release) => {
    const nextVisibility = !release.is_public;
    setUpdatingVisibilityId(release.id);

    try {
      const { data, error } = await supabase
        .from('releases')
        .update({ is_public: nextVisibility })
        .eq('id', release.id)
        .select('id, is_public')
        .maybeSingle();

      if (error) throw new Error(`Could not save visibility: ${error.message}`);
      if (!data) {
        throw new Error('Could not save visibility: no row was updated. Check the Supabase UPDATE/RLS policy for releases.');
      }
      if (data.is_public !== nextVisibility) {
        throw new Error('Supabase returned an unexpected visibility value. The database schema may be out of date.');
      }

      await fetchReleases();
      showAlert('success', `Release v${release.version} is now ${nextVisibility ? 'Public' : 'Private'}.`);
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'Could not save release visibility.');
    } finally {
      setUpdatingVisibilityId(null);
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    // Find the release to get its version
    const release = releases.find((r) => r.id === id);
    if (!release) return;

    // Delete from storage
    const storagePath = `${release.version}/${filename}`;
    await supabase.storage.from('updates').remove([storagePath]);

    // Delete from DB
    await supabase.from('releases').delete().eq('id', id);

    setReleases((prev) => prev.filter((r) => r.id !== id));
    showAlert('success', 'Release deleted.');
  };

  const handleSignOut = () => {
    sessionStorage.removeItem('ap_cloud_auth');
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-lg shadow-sm dark:border-white/10 dark:bg-black/20">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="flex shrink-0 items-center gap-2.5 font-bold text-foreground no-underline">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-sm">
              ☁️
            </div>
            <span className="hidden sm:inline">AP-Cloud</span>
          </a>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeSwitcher />
            <Badge variant="purple" className="hidden sm:inline-flex">Admin</Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              className="h-8 gap-2 rounded-full px-3 sm:px-4"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="flex-1 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Release Manager</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload and manage installer releases distributed to users.
            </p>
          </div>

          {/* Alert */}
          {alert && (
            <Alert
              variant={alert.type === 'success' ? 'success' : 'error'}
              className="fixed bottom-6 right-6 z-[1000] w-[min(390px,calc(100vw-32px))] shadow-xl"
            >
              {alert.type === 'success'
                ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                : <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              }
              <span>{alert.msg}</span>
            </Alert>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">

            {/* ── Upload Form ── */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Upload New Release
                </span>
                <Separator className="flex-1" />
              </div>

              <Card>
                <CardContent className="pt-6">
                  <form onSubmit={handleUpload} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="app-name">App Name</Label>
                      <Input
                        id="app-name"
                        type="text"
                        placeholder="e.g. MyApp Desktop"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        disabled={uploading}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="version">Version</Label>
                      <Input
                        id="version"
                        type="text"
                        placeholder="e.g. 1.0.0"
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        disabled={uploading}
                      />
                      <span className="text-xs text-muted-foreground">
                        Used in download URLs: /download/1.0.0
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="release-notes">Release Notes (optional)</Label>
                      <Textarea
                        id="release-notes"
                        placeholder="What's new in this version..."
                        value={releaseNotes}
                        onChange={(e) => setReleaseNotes(e.target.value)}
                        disabled={uploading}
                        rows={3}
                      />
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="flex cursor-pointer items-start gap-3">
                        <Checkbox
                          id="is-public"
                          checked={isPublic}
                          onCheckedChange={(checked) => setIsPublic(!!checked)}
                          disabled={uploading}
                          className="mt-0.5"
                        />
                        <span className="text-sm leading-snug">
                          <strong className="font-semibold text-foreground">Make this release public</strong>
                          <small className="mt-0.5 block text-xs text-muted-foreground">
                            Public releases appear on the home page and can be downloaded without login.
                          </small>
                        </span>
                      </label>

                      <label className="flex cursor-pointer items-start gap-3">
                        <Checkbox
                          id="is-latest"
                          checked={isLatest}
                          onCheckedChange={(checked) => setIsLatest(!!checked)}
                          disabled={uploading}
                          className="mt-0.5"
                        />
                        <span className="text-sm leading-snug">
                          <strong className="font-semibold text-foreground">Set as Latest Version</strong>
                          <small className="mt-0.5 block text-xs text-muted-foreground">
                            This automatically removes Latest from the previous release.
                          </small>
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label>File</Label>
                      <DropZone onFileSelected={setFile} disabled={uploading} />
                    </div>

                    {uploading && <ProgressBar progress={progress} label="Uploading to Supabase..." />}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={uploading || !file || !appName || !version}
                      id="upload-btn"
                    >
                      {uploading ? (
                        <>
                          <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <CloudUpload className="h-4 w-4" />
                          Upload Release
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* ── Release List ── */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  All Releases
                </span>
                <Badge variant="default" className="text-xs">{releases.length}</Badge>
                <Separator className="flex-1" />
              </div>

              {loadingReleases ? (
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <span className="spinner" style={{ width: 32, height: 32 }} />
                  <span className="text-sm">Loading releases...</span>
                </div>
              ) : releases.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
                  <Package className="h-10 w-10 opacity-40" />
                  <p className="font-semibold text-foreground">No releases yet</p>
                  <p className="text-sm">Upload your first release using the form.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {releases.map((r) => (
                    <ReleaseCard
                      key={r.id}
                      release={r}
                      onDelete={handleDelete}
                      onVisibilityChange={handleVisibilityChange}
                      visibilityUpdating={updatingVisibilityId === r.id}
                      onLatestChange={handleLatestChange}
                      latestUpdating={updatingLatestId === r.id}
                      baseUrl={baseUrl}
                      edgeFunctionUrl={edgeFunctionUrl}
                    />
                  ))}
                </div>
              )}


            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        AP-Cloud Admin · Powered by Supabase
      </footer>
    </div>
  );
};

// ─── Main Export ──────────────────────────────────────────────────────────────
const AdminPage: React.FC = () => {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('ap_cloud_auth') === '1');

  if (!authed) return <AuthGate onAuth={() => setAuthed(true)} />;
  return <AdminPanel />;
};

export default AdminPage;
