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
      <div className="max-w-350 mx-auto px-4 sm:px-8 py-2.5 sm:py-0 min-h-0 sm:min-h-16.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <BrandMark />
          <span className="font-display font-bold text-[13px] sm:text-[15px] tracking-[-0.02em] truncate">
            Sana Distributors
          </span>
          <span className="ui-chip hidden sm:inline-flex">P{role}</span>
        </div>

        <div
          className={`grid ${role === 1 ? 'grid-cols-4' : 'grid-cols-2'} w-full sm:w-auto sm:flex sm:items-center gap-2 shrink-0`}
        >
          <ThemeToggle />

          {role === 1 && onSyncSheets && (
            <button
              type="button"
              disabled={syncingSheets}
              onClick={onSyncSheets}
              aria-label="Sync Sheets"
              className="ledger-btn-secondary w-full sm:w-auto px-2 sm:px-3 py-2 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.08em] sm:tracking-[0.12em]"
            >
              <span className="sm:hidden">{syncingSheets ? 'Syncing' : 'Sync'}</span>
              <span className="hidden sm:inline">
                {syncingSheets ? 'Syncing...' : 'Sync Sheets'}
              </span>
            </button>
          )}

          {role === 1 && onNewForm && (
            <button
              type="button"
              onClick={onNewForm}
              aria-label="New Form"
              className="ledger-btn-primary w-full sm:w-auto px-2 sm:px-4 py-2 font-display text-[11px] font-bold uppercase tracking-[0.08em] sm:tracking-[0.12em]"
            >
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">+ New Form</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign Out"
            className="ledger-btn-secondary w-full sm:w-auto px-2 sm:px-3 py-2 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.08em] sm:tracking-[0.12em]"
          >
            <span className="sm:hidden">Exit</span>
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
