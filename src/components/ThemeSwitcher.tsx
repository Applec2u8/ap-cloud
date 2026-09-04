import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type Theme = 'light' | 'dark' | 'liquid-glass';

const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '◐' },
  { value: 'liquid-glass', label: 'liquid', icon: '✦' },
];

const getStoredTheme = (): Theme => {
  const saved = localStorage.getItem('ap_cloud_theme');
  if (saved === 'dark') return 'dark';
  if (saved === 'light') return 'light';
  return 'liquid-glass';
};

const ThemeSwitcher: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    // shadcn dark mode uses 'dark' class; liquid-glass uses data-theme attribute
    root.classList.remove('dark');
    if (theme === 'dark') {
      root.classList.add('dark');
      root.removeAttribute('data-theme');
    } else if (theme === 'liquid-glass') {
      root.setAttribute('data-theme', 'liquid-glass');
    } else {
      root.removeAttribute('data-theme');
    }
    localStorage.setItem('ap_cloud_theme', theme);
  }, [theme]);

  return (
    <div
      role="group"
      aria-label="Choose theme"
      className="flex items-center gap-1 rounded-2xl border border-border/50 bg-background/60 p-1.5 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-black/20"
    >
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => setTheme(t.value)}
          aria-pressed={theme === t.value}
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-300 cursor-pointer',
            theme === t.value
              ? 'bg-muted text-foreground shadow-sm border border-border/50 dark:bg-white/10 dark:shadow-[inset_0_0_15px_rgba(255,255,255,0.1)] dark:border-white/30'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:scale-105 border border-transparent dark:hover:bg-white/15'
          )}
        >
          <span>{t.icon}</span>
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ThemeSwitcher;