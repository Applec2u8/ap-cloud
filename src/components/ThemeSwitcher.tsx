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

  const isLiquid = theme === 'liquid-glass';
  const isDark = theme === 'dark';

  return (
    <div
      role="group"
      aria-label="Choose theme"
      className={cn(
        'flex items-center gap-0.5 sm:gap-1 rounded-2xl border p-1 sm:p-1.5 shadow-lg backdrop-blur-md shrink-0',
        isLiquid
          ? 'border-white/20 bg-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
          : isDark
            ? 'border-white/10 bg-black/20'
            : 'border-border/50 bg-background/80'
      )}
    >
      {THEMES.map((t) => {
        const isActive = theme === t.value;

        // Signature active color per mode
        const activeClass =
          t.value === 'light'
            ? 'bg-amber-400/90 text-amber-900 border border-amber-300 shadow-[0_2px_8px_rgba(251,191,36,0.5)] shadow-sm'
            : t.value === 'dark'
            ? 'bg-indigo-500/80 text-white border border-indigo-400/60 shadow-[0_2px_8px_rgba(99,102,241,0.5)] shadow-sm'
            : /* liquid */ 'bg-gradient-to-r from-violet-500/80 to-purple-500/80 text-white border border-violet-400/50 shadow-[0_2px_8px_rgba(139,92,246,0.5)] shadow-sm';

        // Inactive styles adapt to current theme background
        const inactiveClass = isLiquid
          ? 'text-white/50 hover:bg-white/10 hover:text-white hover:scale-105 border border-transparent'
          : isDark
          ? 'text-white/40 hover:bg-white/10 hover:text-white hover:scale-105 border border-transparent'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:scale-105 border border-transparent';

        return (
          <button
            key={t.value}
            type="button"
            onClick={() => setTheme(t.value)}
            aria-pressed={isActive}
            className={cn(
              'flex items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-300 cursor-pointer',
              isActive ? activeClass : inactiveClass
            )}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ThemeSwitcher;