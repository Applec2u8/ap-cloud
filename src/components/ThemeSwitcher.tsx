import React, { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'vivid-glass';

const getStoredTheme = (): Theme => {
  const savedTheme = localStorage.getItem('ap_cloud_theme');
  if (savedTheme === 'dark') return 'dark';
  if (savedTheme === 'light') return 'light';
  return 'vivid-glass';
};

const ThemeSwitcher: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ap_cloud_theme', theme);
  }, [theme]);

  return (
    <div className="theme-switcher" role="group" aria-label="Choose theme">
      {(['light', 'dark', 'vivid-glass'] as Theme[]).map((option) => (
        <button
          key={option}
          type="button"
          className={`theme-switcher__button ${theme === option ? 'theme-switcher__button--active' : ''}`}
          onClick={() => setTheme(option)}
          aria-pressed={theme === option}
        >
          {option === 'light' ? '☀ Light' : option === 'dark' ? '◐ Dark' : '✦ Vivid Glass'}
        </button>
      ))}
    </div>
  );
};

export default ThemeSwitcher;