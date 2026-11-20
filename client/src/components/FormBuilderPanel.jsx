import React, { useState, useEffect } from 'react';
import { ConfirmModal } from './ConfirmModal.jsx';
import { SalesChart } from './SalesChart.jsx';
import { fetchCustomerById } from '../api/sheetsApi.js';

const CHANNEL_OPTIONS = ['S.D', 'W.S', 'Retail', 'Key accounts'];
const CHEQUE_STATUS_OPTIONS = ['No', 'Yes'];
const CREDIT_TYPE_OPTIONS = ['Increment', 'Decrement', 'New', 'Closure'];

export function buildPartialAutoFillUpdates(customer) {
  if (!customer || typeof customer !== 'object') return {};
  const updates = {};

  if (customer.customerName) updates.cName = String(customer.customerName);
  if (customer.businessName) updates.bName = String(customer.businessName);
  if (customer.channel) {
    const matchedChannel = CHANNEL_OPTIONS.find(
      (opt) => opt.toLowerCase() === String(customer.channel).trim().toLowerCase()
    );
    if (matchedChannel) updates.channel = matchedChannel;
  }
  if (customer.cnic) updates.cnicNo = String(customer.cnic);
  if (customer.ntn) updates.ntnNo = String(customer.ntn);
  if (customer.mobile) updates.mobileNo = String(customer.mobile);
  if (customer.address) updates.address = String(customer.address);
  if (customer.days) updates.days = String(customer.days);
  if (customer.creditLimit !== null && customer.creditLimit !== undefined) {
    updates.creditLimit = String(customer.creditLimit);
  }

  return updates;
}
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function validateAndPreviewImage(file) {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      reject(new Error('Only JPEG, PNG, or WEBP images are allowed.'));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      reject(new Error('Image file must be 5MB or smaller.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export function FormBuilderPanel({
  initialForm = null,
  onSave,
  onCancel,
}) {
  const isEditMode = Boolean(initialForm && initialForm._id);

  const [customerId, setCustomerId] = useState(initialForm?.customerId || '');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupNotice, setLookupNotice] = useState('');
  const [salesData, setSalesData] = useState(null);

  const [cName, setCName] = useState(initialForm?.cName || '');
  const [bName, setBName] = useState(initialForm?.bName || '');
  const [shopPicture, setShopPicture] = useState(
    initialForm?.shopPicture || ''
  );
  const [shopPictureFile, setShopPictureFile] = useState(null);
  const [channel, setChannel] = useState(initialForm?.channel || 'S.D');
  const [cnicNo, setCnicNo] = useState(initialForm?.cnicNo || '');
  const [ntnNo, setNtnNo] = useState(initialForm?.ntnNo || '');
  const [mobileNo, setMobileNo] = useState(initialForm?.mobileNo || '');
  const [address, setAddress] = useState(initialForm?.address || '');
  const [days, setDays] = useState(initialForm?.days || '');
  const [creditLimit, setCreditLimit] = useState(
    initialForm?.creditLimit !== undefined && initialForm?.creditLimit !== null
      ? String(initialForm.creditLimit)
      : ''
  );
  const [chequeStatus, setChequeStatus] = useState(
    initialForm?.chequeStatus || 'No'
  );
  const [chequeNo, setChequeNo] = useState(initialForm?.chequeNo || '');
  const [chequeAmount, setChequeAmount] = useState(
    initialForm?.chequeAmount !== undefined &&
      initialForm?.chequeAmount !== null
      ? String(initialForm.chequeAmount)
      : ''
  );
  const [chequePicture, setChequePicture] = useState(
    initialForm?.chequePicture || ''
  );
  const [chequePictureFile, setChequePictureFile] = useState(null);
  const [bankName, setBankName] = useState(initialForm?.bankName || '');
  const [bankBranch, setBankBranch] = useState(initialForm?.bankBranch || '');
  const [creditType, setCreditType] = useState(
    initialForm?.creditType || 'New'
  );

  const [validationError, setValidationError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initialForm?.customerId) return;
    let active = true;
    setLookupLoading(true);
    fetchCustomerById(initialForm.customerId)
      .then((res) => {
        if (!active) return;
        setSalesData({
          customerId: initialForm.customerId,
          salesHistory: res.salesHistory || [],
          summary: res.summary || null,
        });
      })
      .catch(() => {
        if (!active) return;
        setSalesData(null);
      })
      .finally(() => {
        if (active) setLookupLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialForm?.customerId]);

  const handleFetchCustomer = async () => {
    const trimmedId = customerId.trim();
    if (!trimmedId) {
      setLookupNotice('Enter a Customer ID to fetch.');
      return;
    }

    setLookupLoading(true);
    setLookupNotice('');
    try {
      const data = await fetchCustomerById(trimmedId);
      const updates = buildPartialAutoFillUpdates(data.customer);
      if (updates.cName !== undefined) setCName(updates.cName);
      if (updates.bName !== undefined) setBName(updates.bName);
      if (updates.channel !== undefined) setChannel(updates.channel);
      if (updates.cnicNo !== undefined) setCnicNo(updates.cnicNo);
      if (updates.ntnNo !== undefined) setNtnNo(updates.ntnNo);
      if (updates.mobileNo !== undefined) setMobileNo(updates.mobileNo);
      if (updates.address !== undefined) setAddress(updates.address);
      if (updates.days !== undefined) setDays(updates.days);
      if (updates.creditLimit !== undefined) setCreditLimit(updates.creditLimit);
      setSalesData({
        customerId: trimmedId,
        salesHistory: data.salesHistory || [],
        summary: data.summary || null,
      });
    } catch (err) {
      if (err.status === 404) {
        setLookupNotice('Customer ID not found — enter details manually');
      } else {
        setLookupNotice(err.message || 'Unable to fetch customer data.');
      }
      setSalesData(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleImageUpload = async (e, setPreview, setFile) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValidationError('');
    try {
      const dataUrl = await validateAndPreviewImage(file);
      setPreview(dataUrl);
      setFile(file);
    } catch (err) {
      setValidationError(err.message);
      e.target.value = '';
    }
  };

  const handleRequestSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    if (!cName.trim()) return setValidationError('Customer Name is required.');
    if (!bName.trim()) return setValidationError('Business Name is required.');
    if (!shopPicture) return setValidationError('Shop Picture is required.');
    if (!cnicNo.trim()) return setValidationError('CNIC # is required.');
    if (!mobileNo.trim()) return setValidationError('Mobile # is required.');
    if (!address.trim()) return setValidationError('Address is required.');
    if (!days.trim()) return setValidationError('Days is required.');

    const parsedLimit = Number(creditLimit);
    if (
      creditLimit === '' ||
      !Number.isFinite(parsedLimit) ||
      parsedLimit < 0
    ) {
      return setValidationError('Credit limit must be a non-negative number.');
    }

    if (chequeStatus === 'Yes') {
      if (!chequeNo.trim()) return setValidationError('C. no. is required.');
      const parsedChequeAmount = Number(chequeAmount);
      if (
        chequeAmount === '' ||
        !Number.isFinite(parsedChequeAmount) ||
        parsedChequeAmount < 0
      ) {
        return setValidationError('C. Amount must be a non-negative number.');
      }
      if (!chequePicture) {
        return setValidationError('C. Picture is required.');
      }
      if (!bankName.trim()) {
        return setValidationError('Bank name is required.');
      }
    }

    setConfirmOpen(true);
  };

  const handleConfirmedSave = async () => {
    setSaving(true);
    setValidationError('');
    try {
      const formData = new FormData();
      if (customerId.trim()) {
        formData.append('customerId', customerId.trim());
      }
      formData.append('cName', cName.trim());
      formData.append('bName', bName.trim());
      if (shopPictureFile) {
        formData.append('shopPicture', shopPictureFile);
      } else {
        formData.append('shopPicture', shopPicture);
      }
      formData.append('channel', channel);
      formData.append('cnicNo', cnicNo.trim());
      formData.append('ntnNo', ntnNo.trim());
      formData.append('mobileNo', mobileNo.trim());
      formData.append('address', address.trim());
      formData.append('days', days.trim());
      formData.append('creditLimit', String(Number(creditLimit)));
      formData.append('chequeStatus', chequeStatus);
      formData.append('creditType', creditType);

      if (chequeStatus === 'Yes') {
        formData.append('chequeNo', chequeNo.trim());
        formData.append('chequeAmount', String(Number(chequeAmount)));
        formData.append('bankName', bankName.trim());
        formData.append('bankBranch', bankBranch.trim());
        if (chequePictureFile) {
          formData.append('chequePicture', chequePictureFile);
        } else {
          formData.append('chequePicture', chequePicture);
        }
      }

      await onSave(formData);
      setConfirmOpen(false);
    } catch (err) {
      setConfirmOpen(false);
      setValidationError(err.message || 'Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ui-card">
      <div className="ui-card-header px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold text-zinc-950 wrap-break-word">
          {isEditMode
            ? `Edit Form #${String(initialForm._id).slice(-6).toUpperCase()}`
            : 'New Form'}
        </h2>

        <button
          type="button"
          onClick={onCancel}
          className="ledger-btn-secondary px-3 py-1 font-mono-tabular text-xs uppercase tracking-wider"
        >
          Close
        </button>
      </div>

      <form onSubmit={handleRequestSubmit} className="p-4 sm:p-6 space-y-6">
        {validationError && (
          <div
            role="alert"
            className="border border-rose-500 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-900"
          >
            {validationError}
          </div>
        )}

        <div className="ui-box p-4 space-y-3">
          <label
            htmlFor="field-customer-id"
            className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800"
          >
            Customer ID
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              id="field-customer-id"
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleFetchCustomer();
                }
              }}
              placeholder="Enter Customer ID / Code"
              className="ledger-input-white px-3.5 py-2 font-mono-tabular text-sm flex-1"
            />
            <button
              type="button"
              disabled={lookupLoading}
              onClick={handleFetchCustomer}
              className="ledger-btn-primary px-5 py-2 font-display text-xs font-semibold uppercase tracking-widest shrink-0"
            >
              {lookupLoading ? 'Fetching...' : 'Fetch Data'}
            </button>
          </div>
          {lookupNotice && (
            <p
              role="status"
              className="font-mono-tabular text-xs text-amber-900 border border-amber-400 bg-amber-50 px-3 py-2"
            >
              {lookupNotice}
            </p>
          )}
        </div>

        {salesData && (
          <SalesChart
            customerId={salesData.customerId}
            salesHistory={salesData.salesHistory}
            summary={salesData.summary}
            loading={lookupLoading}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="field-cname"
              className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
            >
              1. Customer Name
            </label>
            <input
              id="field-cname"
              type="text"
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder="Customer / Proprietor Name"
              className="ledger-input px-3.5 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="field-bname"
              className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
            >
              2. Business Name
            </label>
            <input
              id="field-bname"
              type="text"
              value={bName}
              onChange={(e) => setBName(e.target.value)}
              placeholder="Business / Shop Name"
              className="ledger-input px-3.5 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2 ui-box p-4">
            <label
              htmlFor="field-shop-picture"
              className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-2"
            >
              3. Shop Picture (Image Upload)
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <input
                id="field-shop-picture"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) =>
                  handleImageUpload(e, setShopPicture, setShopPictureFile)
                }
                className="ledger-file-input"
              />
              {shopPicture && (
                <div className="flex items-center gap-3">
                  <img
                    src={shopPicture}
                    alt="Shop preview"
                    className="h-16 w-24 object-cover border border-zinc-400 bg-white"
                  />
                  <span className="font-mono-tabular text-[11px] text-emerald-800 font-semibold uppercase">
                    Image Attached
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="field-channel"
              className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
            >
              4. Channel
            </label>
            <select
              id="field-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="ledger-input px-3.5 py-2 text-sm"
            >
              {CHANNEL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="field-cnic"
              className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
            >
              5. CNIC #
            </label>
            <input
              id="field-cnic"
              type="text"
              value={cnicNo}
              onChange={(e) => setCnicNo(e.target.value)}
              placeholder="e.g., 35202-1234567-1"
              className="ledger-input px-3.5 py-2 font-mono-tabular text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="field-ntn"
              className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
            >
              6. NTN # (optional)
            </label>
            <input
              id="field-ntn"
              type="text"
              value={ntnNo}
              onChange={(e) => setNtnNo(e.target.value)}
              placeholder="e.g., 1234567-8"
              className="ledger-input px-3.5 py-2 font-mono-tabular text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="field-mobile"
              className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
            >
              7. Mobile #
            </label>
            <input
              id="field-mobile"
              type="text"
              value={mobileNo}
              onChange={(e) => setMobileNo(e.target.value)}
              placeholder="e.g., 0300-1234567"
              className="ledger-input px-3.5 py-2 font-mono-tabular text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="field-address"
              className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
            >
              8. Address
            </label>
            <textarea
              id="field-address"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Complete shop/warehouse street address"
              className="ledger-input px-3.5 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="field-days"
              className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
            >
              9. Days
            </label>
            <input
              id="field-days"
              type="text"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="e.g., 3"
              className="ledger-input px-3.5 py-2 font-mono-tabular text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="field-credit-limit"
              className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
            >
              10. Credit limit
            </label>
            <input
              id="field-credit-limit"
              type="number"
              min="0"
              step="any"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder="0"
              className="ledger-input px-3.5 py-2 font-mono-tabular text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="field-cheque-status"
              className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
            >
              11. Security Cheque
            </label>
            <select
              id="field-cheque-status"
              value={chequeStatus}
              onChange={(e) => setChequeStatus(e.target.value)}
              className="ledger-input px-3.5 py-2 font-mono-tabular text-sm"
            >
              {CHEQUE_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="field-credit-type"
              className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
            >
              12. Credit type
            </label>
            <select
              id="field-credit-type"
              value={creditType}
              onChange={(e) => setCreditType(e.target.value)}
              className="ledger-input px-3.5 py-2 text-sm"
            >
              {CREDIT_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {chequeStatus === 'Yes' && (
          <div
            data-testid="conditional-cheque-fields"
            className="ui-box p-5 space-y-4"
          >
            <div className="border-b border-zinc-300 pb-2">
              <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-zinc-950">
                Cheque Details
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="field-cheque-no"
                  className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
                >
                  C. no.
                </label>
                <input
                  id="field-cheque-no"
                  type="text"
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                  placeholder="Cheque Number"
                  className="ledger-input-white px-3.5 py-2 font-mono-tabular text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="field-cheque-amount"
                  className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
                >
                  C. Amount
                </label>
                <input
                  id="field-cheque-amount"
                  type="number"
                  min="0"
                  step="any"
                  value={chequeAmount}
                  onChange={(e) => setChequeAmount(e.target.value)}
                  placeholder="0"
                  className="ledger-input-white px-3.5 py-2 font-mono-tabular text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="field-bank-name"
                  className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
                >
                  Bank name
                </label>
                <input
                  id="field-bank-name"
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g., HBL, Meezan Bank"
                  className="ledger-input-white px-3.5 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="field-bank-branch"
                  className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-1.5"
                >
                  Bank Branch (optional)
                </label>
                <input
                  id="field-bank-branch"
                  type="text"
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  placeholder="e.g., Gulberg Branch"
                  className="ledger-input-white px-3.5 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="field-cheque-picture"
                  className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-2"
                >
                  C. Picture (File Upload)
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <input
                    id="field-cheque-picture"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) =>
                      handleImageUpload(
                        e,
                        setChequePicture,
                        setChequePictureFile
                      )
                    }
                    className="ledger-file-input"
                  />
                  {chequePicture && (
                    <div className="flex items-center gap-3">
                      <img
                        src={chequePicture}
                        alt="Cheque preview"
                        className="h-16 w-24 object-cover border border-zinc-400 bg-white"
                      />
                      <span className="font-mono-tabular text-[11px] text-emerald-800 font-semibold uppercase">
                        Cheque Image Attached
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-zinc-300 pt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="ledger-btn-secondary w-full sm:w-auto px-4 py-2.5 font-mono-tabular text-xs uppercase tracking-wider"
          >
            Discard
          </button>
          <button
            type="submit"
            className="ledger-btn-primary w-full sm:w-auto px-6 py-2.5 font-display text-xs font-semibold uppercase tracking-widest text-center"
          >
            {isEditMode ? 'Submit Updated Form' : 'Submit Form to Stage 2'}
          </button>
        </div>
      </form>

      <ConfirmModal
        isOpen={confirmOpen}
        title={
          isEditMode
            ? 'Confirm Global Form Edit & Stage Reset'
            : 'Confirm Form Submission to Stage 2'
        }
        description={
          isEditMode
            ? 'Submitting this edit updates all fields globally, resets currentStage to 2, clears prior reviewer comments, and sets isUpdated = true for Checkers 2-4.'
            : 'Submitting this form locks your entries into the ledger at Stage 2 (status: INCOMPLETE) for Person 2 review.'
        }
        summaryItems={[
          { label: 'Customer Name / Business Name', value: `${cName.trim()} - ${bName.trim()}` },
          { label: 'Channel / Credit Type', value: `${channel} / ${creditType}` },
          { label: 'Credit Limit', value: String(creditLimit) },
          { label: 'Target Stage', value: 'Stage 2 (INCOMPLETE)' },
        ]}
        confirmLabel={
          isEditMode ? 'Confirm Reset & Update' : 'Confirm Final Submission'
        }
        busy={saving}
        onConfirm={handleConfirmedSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}
