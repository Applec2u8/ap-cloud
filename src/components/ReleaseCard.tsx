import React, { useState } from 'react';
import type { Release } from '../supabaseClient';

interface ReleaseCardProps {
  release: Release;
  onDelete: (id: string, filename: string) => Promise<void>;
  onVisibilityChange: (release: Release) => Promise<void>;
  visibilityUpdating: boolean;
  onLatestChange: (release: Release) => Promise<void>;
  latestUpdating: boolean;
  baseUrl: string;
}

const formatSize = (bytes: number) => {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'exe': return '⚙️';
    case 'msi': return '🔧';
    case 'zip': return '🗜️';
    case 'pkg': return '📦';
    case 'dmg': return '💿';
    default: return '📄';
  }
};

const ReleaseCard: React.FC<ReleaseCardProps> = ({ release, onDelete, onVisibilityChange, visibilityUpdating, onLatestChange, latestUpdating, baseUrl }) => {
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const dlUrl = `${baseUrl}/dl/${release.version}`;
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete release v${release.version}? This cannot be undone.`)) return;
    setDeleting(true);
    await onDelete(release.id, release.filename);
    setDeleting(false);
  };

  return (
    <article className="release-item">
      <div className="release-item__icon">
        {getFileIcon(release.filename)}
      </div>

      <div className="release-item__body">
        <div className="release-item__name" title={release.filename}>{release.app_name}</div>
        <div className="release-item__meta">
          <span className="release-meta__version">v{release.version}</span>
          <span className="release-item__meta-item" title={release.filename}>📄 {release.filename}</span>
          <span className="release-item__meta-item">💾 {formatSize(release.size)}</span>
          <span className="release-item__meta-item">📅 {formatDate(release.created_at)}</span>
        </div>
      </div>

      <div className="release-item__actions">
        <button className={`latest-pill ${release.is_latest ? 'latest-pill--active' : ''}`} onClick={() => void onLatestChange(release)} disabled={latestUpdating || release.is_latest} title="Set as latest version">
          {latestUpdating ? 'Saving...' : release.is_latest ? 'Latest' : 'Set Latest'}
        </button>
        <button className={`visibility-pill ${release.is_public ? 'visibility-pill--public' : ''}`} onClick={() => void onVisibilityChange(release)} disabled={visibilityUpdating} title="Toggle public visibility">
          {visibilityUpdating ? 'Saving...' : release.is_public ? 'Public' : 'Private'}
        </button>
        <a
          href={release.public_url} target="_blank" rel="noreferrer" className="release-action release-action--view" title="Open file in browser">↗ View</a>
        <button className="release-action release-action--copy" onClick={() => void copyToClipboard(dlUrl)} title="Copy direct download URL">
          {copied ? '✓ Copied' : '⧉ Copy DL'}
        </button>
        <button
          className="release-action release-action--delete"
          onClick={handleDelete}
          disabled={deleting}
          title="Delete release"
          id={`delete-release-${release.id}`}
        >
          {deleting ? '⏳' : '🗑️'}
        </button>
      </div>
    </article>
  );
};

export default ReleaseCard;
