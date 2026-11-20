import React from 'react';
import { ThemeToggle } from './ThemeToggle.jsx';
import { BrandMark } from './BrandMark.jsx';

export function TopNav({
  role,
  onLogout,
  onNewForm,
  onSyncSheets,
  syncingSheets = false,
}) {
  return (
    <header className="ui-nav ledger-surface">
      <div className="max-w-350 mx-auto px-5 sm:px-8 min-h-16.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <BrandMark />
          <span className="font-display font-bold text-[15px] tracking-[-0.02em] truncate">
            Sana Distributors
          </span>
          <span className="ui-chip hidden sm:inline-flex">P{role}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />

          {role === 1 && onSyncSheets && (
            <button
              type="button"
              disabled={syncingSheets}
              onClick={onSyncSheets}
              className="ledger-btn-secondary px-3 py-2 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.12em]"
            >
              {syncingSheets ? 'Syncing...' : 'Sync Sheets'}
            </button>
          )}

          {role === 1 && onNewForm && (
            <button
              type="button"
              onClick={onNewForm}
              className="ledger-btn-primary px-4 py-2 font-display text-[11px] font-bold uppercase tracking-[0.12em]"
            >
              + New Form
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="ledger-btn-secondary px-3 py-2 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.12em]"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
