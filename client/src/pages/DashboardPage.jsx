import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useForms } from '../hooks/useForms.js';
import {
  EXPORT_FORMS_URL,
  createForm,
  updateForm,
  deleteForm,
  reviewForm,
  sendCredit,
  filterFormsByCategory,
} from '../api/formsApi.js';
import { syncGoogleSheets } from '../api/sheetsApi.js';
import { TopNav } from '../components/TopNav.jsx';
import { StatFilterBar } from '../components/StatFilterBar.jsx';
import { FormRowList } from '../components/FormRowList.jsx';
import { FormBuilderPanel } from '../components/FormBuilderPanel.jsx';
import { FormReviewPanel } from '../components/FormReviewPanel.jsx';
import { ConfirmModal } from '../components/ConfirmModal.jsx';

export function DashboardPage() {
  const { role, logout } = useAuth();
  const { forms, stats, loading, error, reload } = useForms();

  const [activeFilter, setActiveFilter] = useState('TOTAL');
  const [builderState, setBuilderState] = useState({
    open: false,
    editingForm: null,
  });
  const [selectedFormId, setSelectedFormId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [syncBanner, setSyncBanner] = useState(null);
  const detailPanelRef = useRef(null);

  useEffect(() => {
    if (builderState.open || selectedFormId) {
      detailPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [builderState.open, builderState.editingForm, selectedFormId]);

  const filteredForms = useMemo(
    () => filterFormsByCategory(forms, activeFilter),
    [forms, activeFilter]
  );

  const selectedForm = useMemo(
    () => forms.find((f) => f._id === selectedFormId) || null,
    [forms, selectedFormId]
  );

  const handleOpenCreate = () => {
    setActionError('');
    setSelectedFormId(null);
    setBuilderState({ open: true, editingForm: null });
  };

  const handleOpenEdit = (form) => {
    setActionError('');
    setSelectedFormId(null);
    setBuilderState({ open: true, editingForm: form });
  };

  const handleSaveForm = async (payload) => {
    if (builderState.editingForm) {
      const { form } = await updateForm(builderState.editingForm._id, payload);
      await reload();
      setBuilderState({ open: false, editingForm: null });
      setSelectedFormId(form._id);
    } else {
      const { form } = await createForm(payload);
      await reload();
      setBuilderState({ open: false, editingForm: null });
      setSelectedFormId(form._id);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError('');
    try {
      await deleteForm(deleteTarget._id);
      if (selectedFormId === deleteTarget._id) {
        setSelectedFormId(null);
      }
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      setActionError(err.message || 'Failed to delete form');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleReviewSubmit = async (formId, payload) => {
    await reviewForm(formId, payload);
    await reload();
  };

  const handleSendCredit = async (formId) => {
    await sendCredit(formId);
    await reload();
  };

  const handleSyncSheets = async () => {
    setSyncingSheets(true);
    setSyncBanner(null);
    setActionError('');
    try {
      const res = await syncGoogleSheets();
      setSyncBanner({
        type: 'success',
        text: `Synced ${res.customersSynced} customers and ${res.salesRecordsSynced} sales records${res.skippedRows ? ` (${res.skippedRows} skipped)` : ''}.`,
      });
    } catch (err) {
      setSyncBanner({
        type: 'error',
        text: err.message || 'Google Sheets sync failed',
      });
    } finally {
      setSyncingSheets(false);
    }
  };

  return (
    <div className="ui-shell min-h-screen flex flex-col text-zinc-950">
      <TopNav
        role={role}
        onLogout={logout}
        onNewForm={role === 1 ? handleOpenCreate : null}
        onSyncSheets={role === 1 ? handleSyncSheets : null}
        syncingSheets={syncingSheets}
      />

      <main className="flex-1 w-full max-w-350 mx-auto px-4 sm:px-8 pb-14">
        <section className="ui-hero ledger-reveal pt-7 sm:pt-12 pb-6 sm:pb-7 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
          <div className="min-w-0">
            <p className="font-mono-tabular text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.12em] sm:tracking-[0.2em] text-zinc-500">
              Sana Distributors / Approval Credit Management System
            </p>
            <h1 className="mt-2 font-display text-[32px] sm:text-[42px] lg:text-[58px] font-bold leading-[0.95] sm:leading-[0.88] tracking-tighter sm:tracking-[-0.055em] max-w-full">
              Credit Management System<span className="text-zinc-400">.</span>
            </h1>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
            <p className="font-mono-tabular text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 text-left sm:text-right leading-relaxed">
              {role === 5 ? 'Viewer' : `P${role}`}
              <br />
              <span className="text-zinc-950">
                {filteredForms.length} / {forms.length}
              </span>
            </p>
            <a
              href={EXPORT_FORMS_URL}
              download="sana-customers-export.xlsx"
              aria-label="Export Excel"
              className="bg-green-500 hover:bg-green-600 text-white inline-flex items-center px-3 py-1.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.12em] no-underline rounded transition-colors"
            >
              Export Excel
            </a>
          </div>
        </section>

        <div
          className="ledger-reveal ledger-canvas pt-3 pb-3"
          style={{ animationDelay: '70ms' }}
        >
          <StatFilterBar
            stats={stats}
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
          />
        </div>

        {syncBanner && (
          <div
            role={syncBanner.type === 'error' ? 'alert' : 'status'}
            className={`mb-3 border px-4 py-3 text-xs font-medium flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 ${syncBanner.type === 'error'
              ? 'border-rose-500 bg-rose-50 text-rose-900'
              : 'border-emerald-500 bg-emerald-50 text-emerald-900'
              }`}
          >
            <span>{syncBanner.text}</span>
            <button
              type="button"
              onClick={() => setSyncBanner(null)}
              className="font-mono-tabular text-[11px] uppercase underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {(error || actionError) && (
          <div
            role="alert"
            className="border border-rose-500 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-900"
          >
            {error || actionError}
          </div>
        )}

        <div ref={detailPanelRef} className="scroll-mt-24">
          {builderState.open && role === 1 && (
            <FormBuilderPanel
              initialForm={builderState.editingForm}
              onSave={handleSaveForm}
              onCancel={() => setBuilderState({ open: false, editingForm: null })}
            />
          )}

          {selectedForm && !builderState.open && (
            <FormReviewPanel
              form={selectedForm}
              role={role}
              onReviewSubmit={handleReviewSubmit}
              onSendCredit={handleSendCredit}
              onEditTrigger={role === 1 ? handleOpenEdit : null}
              onClose={() => setSelectedFormId(null)}
            />
          )}
        </div>

        <div
          className="ledger-reveal mt-4"
          style={{ animationDelay: '130ms' }}
        >
          {loading ? (
            <div className="ui-box px-6 py-20 text-center font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Reading Credit Management System
            </div>
          ) : (
            <FormRowList
              forms={filteredForms}
              role={role}
              onInspectForm={(form) => {
                setBuilderState({ open: false, editingForm: null });
                setSelectedFormId(form._id);
              }}
              onEditForm={handleOpenEdit}
              onDeleteForm={(form) => setDeleteTarget(form)}
            />
          )}
        </div>

        <footer className="ui-footer mt-6 pt-4 flex flex-wrap items-center justify-between gap-3 font-mono-tabular text-[9px] font-semibold uppercase tracking-[0.16em]">
          <span>P1 Create · P2–P4 Gate · Filed Complete</span>
          <span>Live Credit Management System</span>
        </footer>
      </main>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Permanently Delete Form Record"
        description="Deleting this form permanently removes the record and its entire approval history from the database."
        summaryItems={
          deleteTarget
            ? [
              { label: 'Title', value: deleteTarget.title },
              {
                label: 'Current Stage',
                value: `Stage ${deleteTarget.currentStage} (${deleteTarget.status})`,
              },
            ]
            : []
        }
        confirmLabel="Delete Record"
        variant="danger"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
