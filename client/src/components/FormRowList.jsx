import React from 'react';

const GATES = [1, 2, 3, 4];

function RouteTrack({ currentStage, status }) {
  const filed = currentStage === 5 || status === 'APPROVED';
  const halted = status === 'REJECTED';

  return (
    <div className="ledger-route">
      {GATES.map((stage, idx) => {
        let variant = '';
        if (filed || (halted && stage < currentStage)) {
          variant = 'ledger-route-cell--passed';
        } else if (halted && stage === currentStage) {
          variant = 'ledger-route-cell--halted';
        } else if (stage === currentStage) {
          variant = 'ledger-route-cell--current';
        } else if (stage < currentStage) {
          variant = 'ledger-route-cell--passed';
        }

        return (
          <React.Fragment key={stage}>
            <span className={`ledger-route-cell ${variant}`} aria-hidden="true">
              P{stage}
            </span>
            {idx < GATES.length - 1 && (
              <span className="ledger-route-link" aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
      <span className="ledger-route-link" aria-hidden="true" />
      <span
        className={`ledger-route-cell ledger-route-cell--filed ${
          filed ? 'ledger-route-cell--filed-on' : ''
        }`}
        aria-hidden="true"
      >
        FILED
      </span>
    </div>
  );
}

function StateMark({ status }) {
  if (status === 'APPROVED') {
    return (
      <span className="ledger-state ledger-state--clear">
        <span className="ledger-state-dot" aria-hidden="true" />
        Approved
      </span>
    );
  }
  if (status === 'REJECTED') {
    return (
      <span className="ledger-state ledger-state--halt">
        <span className="ledger-state-dot" aria-hidden="true" />
        Rejected
      </span>
    );
  }
  return (
    <span className="ledger-state ledger-state--open">
      <span className="ledger-state-dot" aria-hidden="true" />
      Incomplete
    </span>
  );
}

function stageText(form) {
  if (form.currentStage === 5 || form.status === 'APPROVED') {
    return 'Stage 5 / Filed';
  }
  if (form.status === 'REJECTED') {
    return `Stage ${form.currentStage} / Halted at Person ${form.currentStage}`;
  }
  return `Stage ${form.currentStage} / Awaiting Person ${form.currentStage}`;
}

function shortDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString)
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    })
    .toUpperCase();
}

export function FormRowList({
  forms,
  role,
  onInspectForm,
  onEditForm,
  onDeleteForm,
}) {
  if (!forms || forms.length === 0) {
    return (
      <div className="ui-box px-6 py-16 text-center">
        <p className="font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          No records in this view.
        </p>
      </div>
    );
  }

  return (
    <div className="ui-list">
      <div className="ui-table-head hidden md:grid md:grid-cols-12 gap-x-4 px-5 py-2.5 font-mono-tabular text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        <span className="md:col-span-4">Record</span>
        <span className="md:col-span-4">Route</span>
        <span className="md:col-span-2">State</span>
        <span className="md:col-span-2 text-right">Action</span>
      </div>

      {forms.map((form) => {
        const shortId = String(form._id).slice(-6).toUpperCase();
        const isActionableForChecker =
          role >= 2 &&
          role <= 4 &&
          form.status === 'INCOMPLETE' &&
          form.currentStage === role;

        return (
          <div
            key={form._id}
            data-testid="form-ledger-row"
            className="ledger-entry grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-3 px-5 py-5 items-center"
          >
            <div className="md:col-span-4 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onInspectForm(form)}
                  className="font-mono-tabular text-[10px] font-semibold tracking-wider text-zinc-500 hover:text-zinc-950 cursor-pointer"
                >
                  #{shortId}
                </button>
                {form.isUpdated && (
                  <span className="ui-chip ui-chip--warning">
                    Updated / Reset
                  </span>
                )}
                <span className="font-mono-tabular text-[10px] text-zinc-500">
                  {shortDate(form.updatedAt)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onInspectForm(form)}
                className="mt-2 block max-w-full text-left font-display text-[17px] font-bold leading-tight tracking-[-0.02em] text-zinc-950 hover:underline decoration-1 underline-offset-4 cursor-pointer truncate"
              >
                {form.title}
              </button>
            </div>

            <div className="md:col-span-4 min-w-0">
              <span className="sr-only">{stageText(form)}</span>
              <RouteTrack
                currentStage={form.currentStage}
                status={form.status}
              />
            </div>

            <div className="md:col-span-2">
              <StateMark status={form.status} />
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center justify-start md:justify-end gap-1.5">
              {isActionableForChecker && (
                <button
                  type="button"
                  onClick={() => onInspectForm(form)}
                  className="ledger-btn-primary px-3.5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.1em]"
                >
                  Review Gate
                </button>
              )}

              {role !== 1 && !isActionableForChecker && (
                <button
                  type="button"
                  onClick={() => onInspectForm(form)}
                  className="ledger-btn-secondary px-3 py-2 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.1em]"
                >
                  Inspect
                </button>
              )}

              {role === 1 && (() => {
                const isLockedAfterP2 =
                  Number(form.currentStage) > 2 || form.status === 'APPROVED';
                return (
                  <>
                    {isLockedAfterP2 && (
                      <button
                        type="button"
                        onClick={() => onInspectForm(form)}
                        className="ledger-btn-secondary px-2.5 py-2 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.1em]"
                      >
                        Inspect
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isLockedAfterP2}
                      title={
                        isLockedAfterP2
                          ? 'Locked after Person 2 approval'
                          : undefined
                      }
                      onClick={() => !isLockedAfterP2 && onEditForm(form)}
                      className={`ledger-btn-secondary px-2.5 py-2 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.1em] ${
                        isLockedAfterP2 ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isLockedAfterP2}
                      title={
                        isLockedAfterP2
                          ? 'Locked after Person 2 approval'
                          : undefined
                      }
                      onClick={() => !isLockedAfterP2 && onDeleteForm(form)}
                      className={`ledger-btn-danger-soft px-2.5 py-2 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.1em] ${
                        isLockedAfterP2 ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    >
                      Delete
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
