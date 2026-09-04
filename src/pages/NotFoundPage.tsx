import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/20 bg-white/5 backdrop-blur-lg dark:border-white/10 dark:bg-black/20 shadow-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-6">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-foreground no-underline">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-sm">
              ☁️
            </div>
            AP-Cloud
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="text-center">
          <div className="mb-4 bg-gradient-to-br from-blue-600 to-blue-800 bg-clip-text text-8xl font-extrabold text-transparent">
            404
          </div>
          <h1 className="mb-3 text-2xl font-bold text-foreground">Page Not Found</h1>
          <p className="mx-auto mb-8 max-w-sm text-muted-foreground">
            The page you're looking for doesn't exist or the link may have expired.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link to="/">
                <Home className="h-4 w-4" />
                Back Home
              </Link>
            </Button>
            {/* <Button asChild variant="secondary">
              <Link to="/admin">
                <ShieldCheck className="h-4 w-4" />
                Admin Panel
              </Link>
            </Button> */}
          </div>
        </div>
      </div>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        AP-Cloud · Powered by Supabase
      </footer>
    </div>
  );
};

export default NotFoundPage;
