import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import DownloadPage from './pages/DownloadPage';
import DirectDownloadPage from './pages/DirectDownloadPage';
import NotFoundPage from './pages/NotFoundPage';
import PublicPage from './pages/PublicPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public catalog */}
        <Route path="/" element={<PublicPage />} />

        {/* Admin upload & management */}
        <Route path="/admin" element={<AdminPage />} />

        {/* Public download page: /download/:version */}
        <Route path="/download/:version" element={<DownloadPage />} />

        {/* Direct download redirect: /dl/:version */}
        <Route path="/dl/:version" element={<DirectDownloadPage />} />

        {/* 404 */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
