import { supabase } from '../supabaseClient';
import { unzip, zip as rezip } from 'fflate';
import type { VisibilityMap } from '../hooks/useFileVisibility';
import { getEffectiveVisibility } from '../hooks/useFileVisibility';

/**
 * Downloads a source.zip from Supabase Storage, filters out all private
 * files/folders based on the visibilityMap, repacks into a new ZIP, and
 * triggers a browser download.
 *
 * Falls back to a direct signed URL redirect if there are no private
 * paths (avoids unnecessary unzip/rezip overhead).
 *
 * @param repoId        Repository UUID
 * @param commitHash    Full commit hash
 * @param repoName      Used as the downloaded filename
 * @param visibilityMap Map of { path: boolean } from useFileVisibility
 * @param isAdmin       If true, skips filtering entirely
 */
export async function downloadFilteredZip(
  repoId: string,
  commitHash: string,
  repoName: string,
  visibilityMap: VisibilityMap,
  isAdmin: boolean,
): Promise<void> {
  const storagePath = `${repoId}/${commitHash}/source.zip`;

  // Admins or repos with no private paths → just redirect to signed URL
  const hasPrivate = Object.values(visibilityMap).some(v => v === false);
  if (isAdmin || !hasPrivate) {
    const { data } = await supabase.storage
      .from('repo-storage')
      .createSignedUrl(storagePath, 60);
    if (!data?.signedUrl) throw new Error('Could not generate download URL');
    window.open(data.signedUrl, '_blank');
    return;
  }

  // Non-admin + repo has private paths → download, filter, repack
  const { data: blob, error } = await supabase.storage
    .from('repo-storage')
    .download(storagePath);

  if (error || !blob) throw new Error(`Could not download archive: ${error?.message ?? 'no data'}`);

  const uint8 = new Uint8Array(await blob.arrayBuffer());

  // Unzip original
  const unzipped = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(uint8, (err, result) => (err ? reject(err) : resolve(result)));
  });

  // Filter: keep only entries where the path (without trailing slash) is public
  const filtered: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(unzipped)) {
    // Directories end with "/" — strip for visibility check
    const checkPath = name.endsWith('/') ? name.slice(0, -1) : name;
    if (getEffectiveVisibility(checkPath, visibilityMap)) {
      filtered[name] = content;
    }
  }

  // Repack into new ZIP
  const repacked = await new Promise<Uint8Array>((resolve, reject) => {
    rezip(filtered, { level: 0 }, (err, result) => (err ? reject(err) : resolve(result)));
  });

  // Trigger browser download
  const downloadBlob = new Blob([repacked as unknown as BlobPart], { type: 'application/zip' });
  const url = URL.createObjectURL(downloadBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${repoName}-${commitHash.slice(0, 7)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
