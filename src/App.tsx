import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import DownloadPage from './pages/DownloadPage';
import DirectDownloadPage from './pages/DirectDownloadPage';
import LatestVersionPage from './pages/LatestVersionPage';
import NotFoundPage from './pages/NotFoundPage';
import PublicPage from './pages/PublicPage';

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

        {/* Direct download redirect: /dl/:version  (also supports /dl/latest) */}
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
