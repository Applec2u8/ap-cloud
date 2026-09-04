import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  return (
    <div className="page-wrapper">
      <nav className="navbar">
        <div className="navbar__inner">
          <Link to="/" className="navbar__brand">
            <div className="navbar__brand-icon">☁️</div>
            AP-Cloud
          </Link>
        </div>
      </nav>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '6rem',
              marginBottom: 16,
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontWeight: 800,
            }}
          >
            404
          </div>
          <h1 className="heading-lg" style={{ marginBottom: 10 }}>Page Not Found</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 360, margin: '0 auto 28px' }}>
            The page you're looking for doesn't exist or the link may have expired.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" className="btn btn--primary">
              ← Back Home
            </Link>
            <Link to="/admin" className="btn btn--secondary">
              Admin Panel
            </Link>
          </div>
        </div>
      </div>
      <footer className="footer">AP-Cloud · Powered by Supabase</footer>
    </div>
  );
};

export default NotFoundPage;
