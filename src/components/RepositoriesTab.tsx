import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Globe, Lock, Plus, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Repository {
  id: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  default_branch: string;
  created_at: string;
}

const RepositoriesTab: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [creating, setCreating] = useState(false);

  const showAlert = (type: 'success' | 'error', msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  };

  const fetchRepositories = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('repositories')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setRepositories(data as Repository[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showAlert('error', 'Repository name is required.');
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from('repositories').insert({
        name: name.trim(),
        description: description.trim() || null,
        visibility,
      });

      if (error) throw error;

      showAlert('success', `Repository ${name} created successfully!`);
      setName('');
      setDescription('');
      setVisibility('public');
      fetchRepositories();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to create repository.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      {alert && (
        <Alert
          variant={alert.type === 'success' ? 'success' : 'error'}
          className="fixed bottom-6 right-6 z-[1000] w-[min(390px,calc(100vw-32px))] shadow-xl"
        >
          {alert.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          )}
          <span>{alert.msg}</span>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* Create Repo Form */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              New Repository
            </span>
            <Separator className="flex-1" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create a new repository</CardTitle>
              <CardDescription>
                A repository contains all project files, including the revision history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="repo-name">Repository Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="repo-name"
                    placeholder="e.g. ap-cloud-core"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={creating}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="repo-desc">Description</Label>
                  <Textarea
                    id="repo-desc"
                    placeholder="Brief description of this repository"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={creating}
                    rows={3}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Visibility</Label>
                  <div className="grid gap-2">
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                        visibility === 'public' ? 'border-blue-500 bg-blue-500/5' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        className="mt-1"
                        checked={visibility === 'public'}
                        onChange={() => setVisibility('public')}
                        disabled={creating}
                      />
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2 font-semibold">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          Public
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Anyone on the internet can see this repository.
                        </span>
                      </div>
                    </label>

                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                        visibility === 'private' ? 'border-blue-500 bg-blue-500/5' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        className="mt-1"
                        checked={visibility === 'private'}
                        onChange={() => setVisibility('private')}
                        disabled={creating}
                      />
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2 font-semibold">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                          Private
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Only you and authorized users can see this repository.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <Button type="submit" disabled={creating || !name.trim()} className="mt-2 w-full">
                  {creating ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Repository
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Repository List */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Your Repositories
            </span>
            <Badge variant="default" className="text-xs">{repositories.length}</Badge>
            <Separator className="flex-1" />
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <span className="spinner" style={{ width: 32, height: 32 }} />
              <span className="text-sm">Loading repositories...</span>
            </div>
          ) : repositories.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
              <Database className="h-10 w-10 opacity-40" />
              <p className="font-semibold text-foreground">No repositories yet</p>
              <p className="text-sm">Create your first repository using the form.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {repositories.map((repo) => (
                <Card key={repo.id} className="transition-all hover:border-muted-foreground/30">
                  <CardContent className="flex items-start justify-between p-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <a 
                          href={`/repo/ap-cloud/${repo.name}`}
                          className="text-lg font-bold text-blue-500 hover:underline"
                        >
                          {repo.name}
                        </a>
                        <Badge variant={repo.visibility === 'public' ? 'outline' : 'purple'} className="text-[10px] uppercase">
                          {repo.visibility}
                        </Badge>
                      </div>
                      {repo.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {repo.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-yellow-400" /> JavaScript
                        </span>
                        <span>Updated {new Date(repo.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/repo/ap-cloud/${repo.name}`}>View</a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RepositoriesTab;
