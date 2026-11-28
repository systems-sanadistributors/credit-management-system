import React, { useState, useEffect } from 'react';
import { SalesChart } from './SalesChart.jsx';
import { fetchCustomerById } from '../api/sheetsApi.js';

function ReadOnlyRow({ label, value }) {
  return (
    <div
      data-testid="readonly-field-row"
      className="grid grid-cols-1 sm:grid-cols-12 px-3 sm:px-4 py-2.5 gap-1.5 sm:gap-2 items-start sm:items-baseline"
    >
      <div className="sm:col-span-4 font-mono-tabular text-xs font-semibold text-zinc-600 uppercase break-words">
        {label}
      </div>
      <div className="sm:col-span-8 min-w-0 font-mono-tabular text-sm text-zinc-950 bg-white border border-zinc-200 rounded-xl px-3 py-1.5 select-all break-words overflow-x-auto">
        {value !== undefined && value !== null && value !== '' ? String(value) : '—'}
      </div>
    </div>
  );
}

export function FormReviewPanel({
  form,
  role,
  onReviewSubmit,
  onSendCredit,
  onEditTrigger,
  onClose,
}) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingCredit, setSendingCredit] = useState(false);
  const [creditSuccess, setCreditSuccess] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);
  const [salesState, setSalesState] = useState({
    loading: false,
    salesHistory: [],
    summary: null,
    error: '',
  });

  const formCustomerId = form?.customerId || '';

  useEffect(() => {
    if (!formCustomerId) {
      setSalesState({ loading: false, salesHistory: [], summary: null, error: '' });
      return;
    }

    let active = true;
    setSalesState((prev) => ({ ...prev, loading: true, error: '' }));
    fetchCustomerById(formCustomerId)
      .then((res) => {
        if (!active) return;
        setSalesState({
          loading: false,
          salesHistory: res.salesHistory || [],
          summary: res.summary || null,
          error: '',
        });
      })
      .catch((err) => {
        if (!active) return;
        setSalesState({
          loading: false,
          salesHistory: [],
          summary: null,
          error: err.status === 404 ? '' : err.message || 'Failed to load sales history',
        });
      });

    return () => {
      active = false;
    };
  }, [formCustomerId]);

  if (!form) return null;

  const canActOnStage =
    role >= 2 &&
    role <= 4 &&
    form.status === 'INCOMPLETE' &&
    form.currentStage === role;

  const canSendCredit =
    role === 4 && form.status === 'APPROVED' && form.currentStage === 5;

  const handleAction = async (action) => {
    setError('');
    if (!comment.trim()) {
      setError(`Please enter a verification comment before selecting ${action}.`);
      return;
    }

    setSubmitting(true);
    try {
      await onReviewSubmit(form._id, {
        action,
        comment: comment.trim(),
      });
      setComment('');
    } catch (err) {
      setError(err.message || 'Review submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="ui-card">
      <div className="ui-card-header px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="ui-chip">
              RECORD #{String(form._id).slice(-6).toUpperCase()}
            </span>
            <span className="ui-chip ui-chip--stage">
              {form.currentStage === 5
                ? 'STAGE 5 / COMPLETED'
                : `CURRENT STAGE: ${form.currentStage}`}
            </span>
            <span
              className={`ui-badge font-mono-tabular text-xs font-semibold uppercase border ${form.status === 'APPROVED'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                : form.status === 'REJECTED'
                  ? 'border-rose-500 bg-rose-50 text-rose-900'
                  : 'border-amber-500 bg-amber-50 text-amber-900'
                }`}
            >
              {form.status}
            </span>
            {form.isUpdated && (
              <span className="ui-chip ui-chip--warning">
                UPDATED BY PERSON 1 / STAGE RESET
              </span>
            )}
          </div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-zinc-950 break-words">
            {form.title || `${form.cName} - ${form.bName}`}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {role === 1 && onEditTrigger && (() => {
            const isLockedAfterP2 =
              Number(form.currentStage) > 2 || form.status === 'APPROVED';
            return (
              <button
                type="button"
                disabled={isLockedAfterP2}
                title={
                  isLockedAfterP2
                    ? 'Locked after Person 2 approval'
                    : undefined
                }
                onClick={() => !isLockedAfterP2 && onEditTrigger(form)}
                className={`ledger-btn-primary px-3.5 py-1.5 font-mono-tabular text-xs font-semibold uppercase tracking-wider ${
                  isLockedAfterP2 ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                Edit Record
              </button>
            );
          })()}
          <button
            type="button"
            onClick={onClose}
            className="ledger-btn-secondary px-3.5 py-1.5 font-mono-tabular text-xs uppercase tracking-wider"
          >
            Go Back
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h3 className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-2">
            Form Details
          </h3>

          <div className="ui-box divide-y">
            {form.customerId && (
              <ReadOnlyRow label="Customer ID" value={form.customerId} />
            )}
            <ReadOnlyRow label="Customer Name" value={form.cName} />
            <ReadOnlyRow label="Business Name" value={form.bName} />
            <div
              data-testid="readonly-field-row"
              className="grid grid-cols-1 sm:grid-cols-12 px-3 sm:px-4 py-3 gap-1.5 sm:gap-2 items-start"
            >
              <div className="sm:col-span-4 font-mono-tabular text-xs font-semibold text-zinc-600 uppercase break-words">
                Shop Picture
              </div>
              <div className="sm:col-span-8 min-w-0">
                {form.shopPicture ? (
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxImage({
                        label: 'Shop Picture',
                        src: form.shopPicture,
                      })
                    }
                    className="ledger-image-btn"
                  >
                    <img
                      src={form.shopPicture}
                      alt="Shop Picture"
                      className="max-h-48 max-w-full w-auto object-contain"
                    />
                    <span className="mt-1.5 block font-mono-tabular text-[11px] text-zinc-600 uppercase">
                      Click to enlarge
                    </span>
                  </button>
                ) : (
                  <span className="font-mono-tabular text-xs text-zinc-500">
                    No image provided
                  </span>
                )}
              </div>
            </div>
            <ReadOnlyRow label="Channel" value={form.channel} />
            <ReadOnlyRow label="CNIC #" value={form.cnicNo} />
            <ReadOnlyRow label="NTN #" value={form.ntnNo} />
            <ReadOnlyRow label="Mobile #" value={form.mobileNo} />
            <ReadOnlyRow label="Address" value={form.address} />
            <ReadOnlyRow label="Days" value={form.days} />
            <ReadOnlyRow
              label="Credit limit"
              value={
                form.creditLimit !== undefined
                  ? Number(form.creditLimit).toLocaleString()
                  : ''
              }
            />
            <ReadOnlyRow label="Security Cheque" value={form.chequeStatus} />

            {form.chequeStatus === 'Yes' && (
              <>
                <ReadOnlyRow label="C. no." value={form.chequeNo} />
                <ReadOnlyRow
                  label="C. Amount"
                  value={
                    form.chequeAmount !== undefined && form.chequeAmount !== null
                      ? Number(form.chequeAmount).toLocaleString()
                      : ''
                  }
                />
                <ReadOnlyRow label="Bank name" value={form.bankName} />
                <ReadOnlyRow label="Bank Branch" value={form.bankBranch} />
                <div
                  data-testid="readonly-field-row"
                  className="grid grid-cols-1 sm:grid-cols-12 px-3 sm:px-4 py-3 gap-1.5 sm:gap-2 items-start"
                >
                  <div className="sm:col-span-4 font-mono-tabular text-xs font-semibold text-zinc-600 uppercase break-words">
                    C. Picture
                  </div>
                  <div className="sm:col-span-8 min-w-0">
                    {form.chequePicture ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxImage({
                            label: 'C. Picture (Cheque)',
                            src: form.chequePicture,
                          })
                        }
                        className="ledger-image-btn"
                      >
                        <img
                          src={form.chequePicture}
                          alt="Cheque Picture"
                          className="max-h-48 max-w-full w-auto object-contain"
                        />
                        <span className="mt-1.5 block font-mono-tabular text-[11px] text-zinc-600 uppercase">
                          Click to enlarge
                        </span>
                      </button>
                    ) : (
                      <span className="font-mono-tabular text-xs text-zinc-500">
                        No cheque image provided
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}

            <ReadOnlyRow label="Credit type" value={form.creditType} />
          </div>
        </div>

        {form.customerId && (
          <SalesChart
            customerId={form.customerId}
            salesHistory={salesState.salesHistory}
            summary={salesState.summary}
            loading={salesState.loading}
            error={salesState.error}
          />
        )}

        <div>
          <h3 className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-2">
            Sequential Reviewer Audit Trail ({form.comments?.length || 0})
          </h3>

          {!form.comments || form.comments.length === 0 ? (
            <div className="ui-box px-4 py-4 font-mono-tabular text-xs text-zinc-500">
              No reviewer comments recorded yet. Waiting at Stage {form.currentStage}.
            </div>
          ) : (
            <div className="space-y-2">
              {form.comments.map((entry, idx) => (
                <div
                  key={idx}
                  data-testid="stacked-reviewer-comment"
                  className="ui-box px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
                >
                  <div className="min-w-0 text-xs text-zinc-900 break-words">
                    <span className="font-mono-tabular font-bold text-zinc-950">
                      Person {entry.role} Comment:{' '}
                    </span>
                    <span>{entry.comment}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-start">
                    <span
                      className={`ui-badge font-mono-tabular text-[10px] font-semibold uppercase border ${entry.action === 'APPROVED'
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                        : 'border-rose-400 bg-rose-50 text-rose-900'
                        }`}
                    >
                      {entry.action}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canActOnStage ? (
          <div
            data-testid="checker-action-box"
            className="ui-box ui-action p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-zinc-950">
                Person {role} Gate Decision Required (Stage {form.currentStage})
              </span>
              <span className="font-mono-tabular text-[11px] text-zinc-600 break-words sm:text-right">
                {role === 4
                  ? 'FINAL APPROVAL WILL MARK RECORD STAGE 5 / APPROVED'
                  : `APPROVAL ADVANCES RECORD TO STAGE ${form.currentStage + 1}`}
              </span>
            </div>

            {error && (
              <div
                role="alert"
                className="border border-rose-500 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-900 break-words"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="reviewer-comment-input"
                className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
              >
                Person {role} Verification Comment
              </label>
              <textarea
                id="reviewer-comment-input"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={`Enter Person ${role} inspection notes...`}
                className="ledger-input-white p-3 text-sm"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleAction('REJECT')}
                className="ledger-btn-danger w-full sm:w-auto px-5 py-2.5 font-display text-xs font-semibold uppercase tracking-widest"
              >
                Reject Form
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleAction('APPROVE')}
                className="ledger-btn-primary w-full sm:w-auto px-6 py-2.5 font-display text-xs font-semibold uppercase tracking-widest"
              >
                Approve Stage {form.currentStage}
              </button>
            </div>
          </div>
        ) : form.status !== 'APPROVED' ? (
          <div className="ui-box px-4 py-3 font-mono-tabular text-xs text-zinc-600">
            {form.status === 'REJECTED'
              ? `RECORD LOCKED: Rejected at Stage ${form.currentStage}.`
              : `READ-ONLY VIEW: Record is currently assigned to Stage ${form.currentStage} (Person ${form.currentStage}).`}
          </div>
        ) : null}

        {canSendCredit && onSendCredit && (
          <div className="border-t border-zinc-300 pt-5 space-y-3">
            {error && (
              <div
                role="alert"
                className="border border-rose-500 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-900 break-words"
              >
                {error}
              </div>
            )}
            {creditSuccess && (
              <div
                role="status"
                className="border border-emerald-500 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900"
              >
                {creditSuccess}
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {form.creditSentAt ? (
                <span className="font-mono-tabular text-xs text-emerald-800">
                  Credit sent on{' '}
                  {new Date(form.creditSentAt).toLocaleString()}
                </span>
              ) : (
                <span />
              )}
              <button
                type="button"
                disabled={sendingCredit}
                onClick={async () => {
                  setError('');
                  setCreditSuccess('');
                  setSendingCredit(true);
                  try {
                    await onSendCredit(form._id);
                    setCreditSuccess('Credit details sent to Person 5.');
                  } catch (err) {
                    setError(err.message || 'Failed to send credit');
                  } finally {
                    setSendingCredit(false);
                  }
                }}
                className="ledger-btn-primary w-full sm:w-auto px-6 py-2.5 font-display text-xs font-semibold uppercase tracking-widest"
              >
                {sendingCredit ? 'Sending Credit...' : 'Send Credit'}
              </button>
            </div>
          </div>
        )}
      </div>

      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="ui-overlay fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-3 sm:p-6"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="ui-card max-w-3xl w-full max-h-full overflow-auto p-3 sm:p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-300 pb-2">
              <span className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-900 break-words">
                {lightboxImage.label}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="ledger-btn-secondary px-3 py-1 font-mono-tabular text-xs uppercase shrink-0"
              >
                Close
              </button>
            </div>
            <div className="flex justify-center ui-box p-2">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.label}
                className="max-h-[75vh] max-w-full w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
