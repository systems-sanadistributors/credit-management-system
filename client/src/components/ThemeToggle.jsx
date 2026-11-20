import React from 'react';
import { useTheme } from '../hooks/useTheme.js';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="ledger-theme-toggle w-full sm:w-auto justify-center"
    >
      <span className="ledger-theme-track" aria-hidden="true">
        <span className="ledger-theme-thumb" />
      </span>
      <span className="hidden sm:inline font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.12em]">
        {isDark ? 'Dark' : 'Light'}
      </span>
    </button>
  );
}
