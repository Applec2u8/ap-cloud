import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseUrl } from '../supabaseClient';
import type { LinkAlias } from '../supabaseClient';
import { cn } from '@/lib/utils';
import {
  Link as LinkIcon, Copy, Check, Plus, Pencil, Trash2,
  Loader2, AlertTriangle, CheckCircle2, X, ExternalLink,
  Zap, ChevronRight, Upload, Globe2, FileJson,
  ChevronDown, Eye,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const REQUIRED_JSON_KEYS = ['version', 'url', 'notes', 'filename', 'size', 'app_name', 'released_at'] as const;

const JSON_TEMPLATE = {
  version: '1.2.1',
  url: 'https://your-storage-url/path/to/binary.exe',
  notes: 'Release notes or update description',
  filename: 'ANL-AutoHotkey-Installer-v1.2.1.exe',
  size: 40267066,
  app_name: 'ANL-AutoHotkey',
  released_at: '2026-09-06T09:00:15.580031+00:00',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

interface Props {
  repoId: string;
  edgeFunctionUrl: string;
}

// ─── Inline alert ─────────────────────────────────────────────────────────────
const InlineAlert: React.FC<{ type: 'success' | 'error'; msg: string }> = ({ type, msg }) => (
  <div className={cn(
    'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
    type === 'success'
      ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
      : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  )}>
    {type === 'success'
      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
    <span>{msg}</span>
  </div>
);

// ─── JSON Schema Helper ───────────────────────────────────────────────────────
const JsonSchemaHelper: React.FC<{ validKeys: Set<string> | null }> = ({ validKeys }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const templateStr = JSON.stringify(JSON_TEMPLATE, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(templateStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition"
      >
        <span className="flex items-center gap-1.5">
          <FileJson className="h-3.5 w-3.5" />
          Required JSON structure / template
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-amber-500/20 px-3 pb-3 pt-2 space-y-2">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Your uploaded <code className="font-mono">.json</code> file must contain <strong>all 7 keys</strong> listed below.
            The <code className="font-mono">url</code> field must be a direct download link to your binary.
          </p>

          {/* Key checklist — shown when a file is loaded */}
          {validKeys !== null && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {REQUIRED_JSON_KEYS.map(k => (
                <span
                  key={k}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold',
                    validKeys.has(k)
                      ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'border-red-400/40 bg-red-500/10 text-red-600 dark:text-red-400',
                  )}
                >
                  {validKeys.has(k) ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                  {k}
                </span>
              ))}
            </div>
          )}

          {/* Template block */}
          <div className="relative rounded-md bg-muted/60 dark:bg-black/40 border border-border/40 overflow-hidden">
            <pre className="px-3 py-2.5 text-[10px] leading-relaxed font-mono text-foreground overflow-x-auto">
              {templateStr}
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded border border-border/50 bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              {copied ? <><Check className="h-2.5 w-2.5 text-emerald-500" />Copied!</> : <><Copy className="h-2.5 w-2.5" />Copy</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Alias Form ───────────────────────────────────────────────────────────────
type InputMode = 'url' | 'json';

interface AliasFormProps {
  repoId: string;
  defaultTargetUrl: string;
  editing: LinkAlias | null;
  onSaved: () => void;
  onCancel: () => void;
}

const AliasForm: React.FC<AliasFormProps> = ({
  repoId, defaultTargetUrl, editing, onSaved, onCancel,
}) => {
  const [slug, setSlug] = useState(editing?.slug ?? '');
  const [targetUrl, setTargetUrl] = useState(editing?.target_url ?? defaultTargetUrl);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dual-mode state
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonParsedKeys, setJsonParsedKeys] = useState<Set<string> | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate a JSON file client-side
  const validateJsonFile = async (file: File): Promise<{ keys: Set<string>; error: string | null }> => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const keys = new Set(Object.keys(parsed));
      const missing = REQUIRED_JSON_KEYS.filter(k => !keys.has(k));
      if (missing.length > 0) {
        return { keys, error: `Missing required keys: ${missing.join(', ')}` };
      }
      return { keys, error: null };
    } catch {
      return { keys: new Set(), error: 'File is not valid JSON.' };
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setJsonError('Only .json files are accepted.');
      setJsonFile(null);
      setJsonParsedKeys(null);
      return;
    }
    const { keys, error: verr } = await validateJsonFile(file);
    setJsonFile(file);
    setJsonParsedKeys(keys);
    setJsonError(verr);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFileSelect(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimSlug = slug.trim().toLowerCase();
    const trimDesc = description.trim();

    if (!trimSlug) { setError('Slug is required.'); return; }
    if (!SLUG_RE.test(trimSlug)) {
      setError('Slug may only contain lowercase letters, numbers, and hyphens (no leading/trailing hyphens).');
      return;
    }

    let finalUrl = targetUrl.trim();

    if (inputMode === 'json') {
      // ── JSON upload path ────────────────────────────────────────────────
      if (!jsonFile) { setError('Please select a JSON file to upload.'); return; }
      if (jsonError) { setError(`Fix JSON errors before saving: ${jsonError}`); return; }

      setSaving(true);
      setUploading(true);
      try {
        const storagePath = `${repoId}/${trimSlug}.json`;
        const { error: uploadErr } = await supabase.storage
          .from('alias-jsons')
          .upload(storagePath, jsonFile, {
            contentType: 'application/json',
            upsert: true,
          });
        if (uploadErr) throw uploadErr;

        const { data: pubData } = supabase.storage
          .from('alias-jsons')
          .getPublicUrl(storagePath);
        finalUrl = pubData.publicUrl;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed.';
        setError(`Storage upload error: ${msg}`);
        setSaving(false);
        setUploading(false);
        return;
      }
      setUploading(false);
    } else {
      // ── External URL path ───────────────────────────────────────────────
      if (!finalUrl) { setError('Target URL is required.'); return; }
      try { new URL(finalUrl); } catch {
        setError('Target URL is not a valid URL.'); return;
      }
    }

    try {
      if (editing) {
        const { error: err } = await supabase
          .from('link_aliases')
          .update({ slug: trimSlug, target_url: finalUrl, description: trimDesc || null })
          .eq('id', editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('link_aliases')
          .insert({ repository_id: repoId, slug: trimSlug, target_url: finalUrl, description: trimDesc || null });
        if (err) throw err;
      }
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save alias.';
      setError(msg.includes('unique') ? `Slug "${trimSlug}" is already taken in this repository.` : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 flex flex-col gap-3 animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/15">
          {editing ? <Pencil className="h-3 w-3 text-blue-500" /> : <Plus className="h-3 w-3 text-blue-500" />}
        </div>
        <span className="text-xs font-bold text-foreground">
          {editing ? 'Edit Alias' : 'New Alias'}
        </span>
      </div>

      {error && <InlineAlert type="error" msg={error} />}

      {/* Slug */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Slug <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-0 rounded-md border border-border/60 overflow-hidden bg-muted/30 focus-within:ring-2 focus-within:ring-blue-500/40">
          <span className="px-2 text-[11px] text-muted-foreground font-mono border-r border-border/40 bg-muted/50 whitespace-nowrap select-none py-2">
            …/resolve-alias?…&slug=
          </span>
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="my-app-updater"
            disabled={saving}
            className="flex-1 bg-transparent px-2.5 py-2 text-sm font-mono focus:outline-none min-w-0"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">Lowercase letters, numbers and hyphens only.</p>
      </div>

      {/* ── Input Mode Selector ── */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Target Type <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {/* External URL tab */}
          <button
            type="button"
            onClick={() => setInputMode('url')}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition',
              inputMode === 'url'
                ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                : 'border-border/50 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
            )}
          >
            <Globe2 className="h-3.5 w-3.5 shrink-0" />
            External URL
          </button>
          {/* JSON Upload tab */}
          <button
            type="button"
            onClick={() => setInputMode('json')}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition',
              inputMode === 'json'
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-border/50 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
            )}
          >
            <FileJson className="h-3.5 w-3.5 shrink-0" />
            JSON File Upload
          </button>
        </div>
      </div>

      {/* ── Mode A: External URL ── */}
      {inputMode === 'url' && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Target URL <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            value={targetUrl}
            onChange={e => setTargetUrl(e.target.value)}
            placeholder="https://…/functions/v1/latest-version?repo_id=…"
            disabled={saving}
            className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
          />
          <p className="text-[10px] text-muted-foreground">
            The URL this alias will proxy. Pre-filled with your repo's Edge Function URL.
          </p>
        </div>
      )}

      {/* ── Mode B: JSON File Upload ── */}
      {inputMode === 'json' && (
        <div className="flex flex-col gap-2">
          {/* Dropzone */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer px-4 py-6 transition-colors',
              dragOver
                ? 'border-amber-400/70 bg-amber-500/10'
                : jsonFile
                  ? 'border-green-500/40 bg-green-500/5'
                  : 'border-border/50 bg-muted/20 hover:border-amber-400/50 hover:bg-amber-500/5',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleFileSelect(f); }}
            />
            {jsonFile ? (
              <>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/15 border border-green-500/25">
                  <FileJson className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-foreground">{jsonFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">{(jsonFile.size / 1024).toFixed(1)} KB — click to replace</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 border border-border/40">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-foreground">Drop your update .json here</p>
                  <p className="text-[10px] text-muted-foreground">or click to browse — max 512 KB</p>
                </div>
              </>
            )}
          </div>

          {/* Per-file JSON validation feedback */}
          {jsonFile && jsonError && (
            <InlineAlert type="error" msg={jsonError} />
          )}
          {jsonFile && !jsonError && (
            <InlineAlert type="success" msg="JSON structure is valid ✓ — will be uploaded to alias-jsons storage on save." />
          )}

          {/* Uploading indicator */}
          {uploading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uploading to Supabase Storage…
            </div>
          )}

          {/* JSON schema helper (always shown in JSON mode) */}
          <JsonSchemaHelper validKeys={jsonParsedKeys} />
        </div>
      )}

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Windows auto-updater link"
          disabled={saving}
          className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition disabled:opacity-50"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || (inputMode === 'json' && !!jsonError)}
          className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-60"
        >
          {saving
            ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />Saving…</>
            : <><Check className="h-3 w-3" />{editing ? 'Save Changes' : 'Create Alias'}</>}
        </button>
      </div>
    </form>
  );
};

// ─── Alias Row ────────────────────────────────────────────────────────────────
interface AliasRowProps {
  alias: LinkAlias;
  repoId: string;
  onEdit: (a: LinkAlias) => void;
  onDeleted: (id: string) => void;
}

const AliasRow: React.FC<AliasRowProps> = ({ alias, repoId, onEdit, onDeleted }) => {
  const [copied, setCopied] = useState<'alias' | 'target' | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Detect whether target is a Supabase Storage JSON (alias-jsons bucket)
  const isStorageJson = alias.target_url.includes('/storage/v1/object/public/alias-jsons/');

  const publicUrl = `${supabaseUrl}/functions/v1/resolve-alias?repo_id=${repoId}&slug=${alias.slug}`;

  const copy = async (text: string, key: 'alias' | 'target') => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete alias "${alias.slug}"? Client apps using this URL will stop working.`)) return;
    setDeleting(true);
    const { error } = await supabase.from('link_aliases').delete().eq('id', alias.id);
    if (!error) onDeleted(alias.id);
    else setDeleting(false);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden transition-all hover:border-blue-300/50 animate-fade-in">
      {/* Row header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:p-3.5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Icon */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
            {isStorageJson
              ? <FileJson className="h-3.5 w-3.5 text-amber-500" />
              : <Globe className="h-3.5 w-3.5 text-blue-500" />}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400 truncate">
                {alias.slug}
              </span>
              {isStorageJson && (
                <span className="text-[10px] font-bold uppercase tracking-wider rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 whitespace-nowrap">
                  JSON
                </span>
              )}
              {alias.description && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                  — {alias.description}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate max-w-[280px] font-mono">
                {alias.target_url}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t border-border/30 sm:border-t-0 justify-end flex-wrap">
          {/* Copy alias URL */}
          <button
            type="button"
            onClick={() => void copy(publicUrl, 'alias')}
            title="Copy alias URL"
            className="flex h-7 items-center gap-1 rounded-full border border-blue-300/40 bg-blue-500/10 px-2.5 text-[11px] font-bold text-blue-700 hover:bg-blue-500/20 dark:text-blue-300 transition whitespace-nowrap"
          >
            {copied === 'alias'
              ? <><Check className="h-3 w-3 text-emerald-500" />Copied!</>
              : <><Copy className="h-3 w-3" />Copy Link</>}
          </button>

          {/* Open target */}
          <a
            href={alias.target_url}
            target="_blank"
            rel="noreferrer"
            title="Open target URL"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border/40 text-muted-foreground hover:bg-accent hover:text-foreground transition"
          >
            {isStorageJson ? <Eye className="h-3 w-3" /> : <ExternalLink className="h-3 w-3" />}
          </a>

          {/* Edit */}
          <button
            type="button"
            onClick={() => onEdit(alias)}
            title="Edit alias"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border/40 text-muted-foreground hover:bg-accent hover:text-foreground transition"
          >
            <Pencil className="h-3 w-3" />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            title="Delete alias"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition disabled:opacity-50"
          >
            {deleting
              ? <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
              : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Public alias URL bar */}
      <div className="border-t border-border/40 bg-muted/20 dark:bg-muted/10 px-3 py-2 flex items-center gap-2">
        <LinkIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="flex-1 min-w-0 truncate font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
          {publicUrl}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatDate(alias.created_at)}
        </span>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const LinkAliasesManager: React.FC<Props> = ({ repoId, edgeFunctionUrl }) => {
  const [aliases, setAliases] = useState<LinkAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LinkAlias | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showAlert = (type: 'success' | 'error', msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  };

  const fetchAliases = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('link_aliases')
      .select('*')
      .eq('repository_id', repoId)
      .order('created_at', { ascending: false });
    if (!error && data) setAliases(data as LinkAlias[]);
    setLoading(false);
  }, [repoId]);

  useEffect(() => { void fetchAliases(); }, [fetchAliases]);

  const handleSaved = async () => {
    await fetchAliases();
    setShowForm(false);
    setEditing(null);
    showAlert('success', editing ? 'Alias updated.' : 'Alias created successfully!');
  };

  const handleEdit = (a: LinkAlias) => {
    setEditing(a);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleDeleted = (id: string) => {
    setAliases(prev => prev.filter(a => a.id !== id));
    showAlert('success', 'Alias deleted.');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-blue-500" />
            Link Aliases
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Permanent proxy URLs that always resolve to the configured target — even when the target URL changes.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            id="link-alias-create-btn"
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="shrink-0 flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
          >
            <Plus className="h-3 w-3" />
            New Alias
          </button>
        )}
      </div>

      {/* Inline alert */}
      {alert && <InlineAlert type={alert.type} msg={alert.msg} />}

      {/* Create / Edit form */}
      {showForm && (
        <AliasForm
          repoId={repoId}
          defaultTargetUrl={edgeFunctionUrl}
          editing={editing}
          onSaved={handleSaved}
          onCancel={handleCancel}
        />
      )}

      {/* How it works callout */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3.5 py-3 flex gap-3">
        <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground text-xs block mb-0.5">How it works</strong>
          Each alias provides a <span className="font-mono text-blue-500">resolve-alias</span> Edge Function URL
          that <em>permanently</em> stays the same. When called, it transparently proxies whatever{' '}
          <strong>Target URL</strong> you configure — point it at an external URL{' '}
          <em>or</em> upload a custom <strong>JSON file</strong> directly to storage.
          Rotate the target any time without touching client applications.
        </div>
      </div>

      {/* Alias list */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin" />
          <span className="text-sm">Loading aliases…</span>
        </div>
      ) : aliases.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center text-muted-foreground rounded-xl border border-dashed border-border/60">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
            <LinkIcon className="h-6 w-6 opacity-50" />
          </div>
          <p className="font-semibold text-foreground text-sm">No aliases yet</p>
          <p className="text-xs max-w-xs">
            Create your first link alias. Client applications embed this URL permanently — you update only the target mapping here.
          </p>
          {!showForm && (
            <button
              type="button"
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="mt-1 flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
            >
              <Plus className="h-3 w-3" />
              Create First Alias
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {aliases.map(a => (
            <AliasRow
              key={a.id}
              alias={a}
              repoId={repoId}
              onEdit={handleEdit}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Named re-export kept for compatibility
const Globe = Globe2;

export default LinkAliasesManager;
