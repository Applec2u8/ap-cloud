import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { unzip } from 'fflate';
import { supabase } from '../supabaseClient';

export interface RepoFile {
  path: string;
  content: Uint8Array;
}

export interface Commit {
  id: string;
  commit_hash: string;
  message: string;
  created_at: string;
}

export interface RepoInfo {
  id: string;
  name: string;
  description: string | null;
  visibility: 'public' | 'private';
  default_branch: string;
  created_at: string;
}

interface RepoContextValue {
  repoInfo: RepoInfo | null;
  commits: Commit[];
  activeCommit: Commit | null;
  files: RepoFile[];
  loadingRepo: boolean;
  loadingFiles: boolean;
  repoError: string | null;
  filesError: string | null;
  loadRepo: (repoName: string) => Promise<RepoInfo | null>;
  loadCommits: (repoId: string) => Promise<Commit[]>;
  loadFiles: (repoId: string, commit: Commit) => Promise<void>;
  selectCommit: (commit: Commit) => void;
  setRepoInfo: React.Dispatch<React.SetStateAction<RepoInfo | null>>;
  setCommits: React.Dispatch<React.SetStateAction<Commit[]>>;
}

const RepoContext = createContext<RepoContextValue | null>(null);

export const useRepo = () => {
  const ctx = useContext(RepoContext);
  if (!ctx) throw new Error('useRepo must be used inside RepoProvider');
  return ctx;
};

async function downloadAndUnzip(repoId: string, commitHash: string): Promise<RepoFile[]> {
  const path = `${repoId}/${commitHash}/source.zip`;
  const { data, error } = await supabase.storage.from('repo-storage').download(path);
  if (error || !data) throw new Error(`Could not download zip: ${error?.message ?? 'no data'}`);
  const uint8 = new Uint8Array(await data.arrayBuffer());
  return new Promise<RepoFile[]>((resolve, reject) => {
    unzip(uint8, (err, unzipped) => {
      if (err) return reject(err);
      const files = Object.entries(unzipped)
        .filter(([name]) => !name.endsWith('/'))
        .map(([path, content]) => ({ path, content }));
      resolve(files);
    });
  });
}

export const RepoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [activeCommit, setActiveCommit] = useState<Commit | null>(null);
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);

  // Cache: avoid re-downloading same commit
  const fileCache = useRef<Map<string, RepoFile[]>>(new Map());

  const loadRepo = useCallback(async (repoName: string): Promise<RepoInfo | null> => {
    setLoadingRepo(true);
    setRepoError(null);
    try {
      const { data, error } = await supabase
        .from('repositories').select('*').eq('name', repoName).single();
      if (error || !data) throw new Error(error?.message ?? 'Repository not found');
      setRepoInfo(data as RepoInfo);
      return data as RepoInfo;
    } catch (err: any) {
      setRepoError(err.message);
      return null;
    } finally {
      setLoadingRepo(false);
    }
  }, []);

  const loadCommits = useCallback(async (repoId: string): Promise<Commit[]> => {
    const { data } = await supabase
      .from('commits').select('*').eq('repo_id', repoId).order('created_at', { ascending: false });
    const list = (data ?? []) as Commit[];
    setCommits(list);
    return list;
  }, []);

  const loadFiles = useCallback(async (repoId: string, commit: Commit): Promise<void> => {
    const cacheKey = `${repoId}/${commit.commit_hash}`;
    if (fileCache.current.has(cacheKey)) {
      setFiles(fileCache.current.get(cacheKey)!);
      setActiveCommit(commit);
      return;
    }
    setLoadingFiles(true);
    setFilesError(null);
    setFiles([]);
    try {
      const repoFiles = await downloadAndUnzip(repoId, commit.commit_hash);
      fileCache.current.set(cacheKey, repoFiles);
      setFiles(repoFiles);
      setActiveCommit(commit);
    } catch (err: any) {
      setFilesError(err.message);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const selectCommit = useCallback((commit: Commit) => {
    setActiveCommit(commit);
  }, []);

  return (
    <RepoContext.Provider value={{
      repoInfo, commits, activeCommit, files,
      loadingRepo, loadingFiles, repoError, filesError,
      loadRepo, loadCommits, loadFiles, selectCommit, setRepoInfo, setCommits,
    }}>
      {children}
    </RepoContext.Provider>
  );
};
