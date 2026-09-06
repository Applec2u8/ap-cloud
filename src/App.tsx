import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import DownloadPage from './pages/DownloadPage';
import DirectDownloadPage from './pages/DirectDownloadPage';
import LatestVersionPage from './pages/LatestVersionPage';
import NotFoundPage from './pages/NotFoundPage';
import PublicPage from './pages/PublicPage';
import RepositoryPage from './pages/RepositoryPage';
import TreePage from './pages/TreePage';
import BlobPage from './pages/BlobPage';
import SettingsPage from './pages/SettingsPage';
import ReleasesPage from './pages/ReleasesPage';
import LinksPage from './pages/LinksPage';
import { RepoProvider } from './context/RepoContext';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public catalog */}
        <Route path="/" element={<PublicPage />} />

        {/* Admin upload & management */}
        <Route path="/cloud-admin" element={<AdminPage />} />

        {/* Public download page: /download/:version */}
        <Route path="/download/:version" element={<DownloadPage />} />

        {/* Repository routes — all share the same RepoProvider context */}
        <Route
          path="/repo/:owner/:repoName/*"
          element={
            <RepoProvider>
              <Routes>
                {/* Root: /repo/:owner/:repoName */}
                <Route index element={<RepositoryPage />} />

                {/* Directory tree: /repo/:owner/:repoName/tree/:branch/* */}
                <Route path="tree/:branch/*" element={<TreePage />} />

                {/* File blob: /repo/:owner/:repoName/blob/:branch/* */}
                <Route path="blob/:branch/*" element={<BlobPage />} />

                {/* Settings: /repo/:owner/:repoName/settings */}
                <Route path="settings" element={<SettingsPage />} />

                {/* Releases: /repo/:owner/:repoName/releases */}
                <Route path="releases" element={<ReleasesPage />} />

                {/* Links (aliases): /repo/:owner/:repoName/links */}
                <Route path="links" element={<LinksPage />} />
              </Routes>
            </RepoProvider>
          }
        />

        {/* Direct download redirect: /dl/:version */}
        <Route path="/dl/:version" element={<DirectDownloadPage />} />

        {/* Auto-Updater JSON endpoint: /api/latest */}
        <Route path="/api/latest" element={<LatestVersionPage />} />

        {/* 404 */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
