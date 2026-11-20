import React from 'react';

export function ConfirmModal({
  isOpen,
  title,
  description,
  summaryItems = [],
  confirmLabel = 'Confirm & Commit',
  cancelLabel = 'Cancel',
  variant = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  const confirmBtnClass =
    variant === 'danger' ? 'ledger-btn-danger' : 'ledger-btn-primary';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="ui-overlay fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-3 sm:p-4"
    >
      <div className="ui-card w-full max-w-lg max-h-full overflow-auto">
        <div className="ui-card-header px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
          <span className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-900">
            Final Action Verification
          </span>
          <span className="font-mono-tabular text-[11px] text-zinc-500">
            CONFIRMATION REQUIRED
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <h2
            id="confirm-modal-title"
            className="font-display text-lg font-bold text-zinc-950 break-words"
          >
            {title}
          </h2>
          <p className="text-xs leading-relaxed text-zinc-600 break-words">{description}</p>

          {summaryItems.length > 0 && (
            <div className="ui-box p-3 space-y-2 font-mono-tabular text-xs">
              {summaryItems.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 min-w-0">
                  <span className="text-zinc-500 uppercase shrink-0">{item.label}:</span>
                  <span className="text-zinc-950 font-semibold break-words sm:text-right min-w-0">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ui-card-footer px-4 sm:px-6 py-3.5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="ledger-btn-secondary w-full sm:w-auto px-4 py-2 font-mono-tabular text-xs uppercase tracking-wider"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`w-full sm:w-auto px-5 py-2 font-display text-xs font-semibold uppercase tracking-wider ${confirmBtnClass}`}
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
