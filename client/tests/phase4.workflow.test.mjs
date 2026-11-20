import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const REVIEW_SAMPLE_FORM = {
  _id: '673a00000000000000000999',
  title: 'Usman Ali — Sana Key Accounts Hub',
  cName: 'Usman Ali',
  bName: 'Sana Key Accounts Hub',
  shopPicture: SAMPLE_PNG_DATA_URL,
  channel: 'Key accounts',
  cnicNo: '42101-7654321-3',
  ntnNo: '8877665-1',
  mobileNo: '0321-9876543',
  address: 'Suite 9, Shahrah-e-Faisal, Karachi',
  days: '60',
  creditLimit: 1500000,
  chequeStatus: 'Yes',
  chequeNo: 'CHQ-771234',
  chequeAmount: 1500000,
  chequePicture: SAMPLE_PNG_DATA_URL,
  bankName: 'Meezan Bank',
  bankBranch: 'Clifton Branch',
  creditType: 'Increment',
  currentStage: 4,
  status: 'INCOMPLETE',
  isUpdated: true,
  comments: [
    {
      role: 2,
      comment: 'Shop front and cheque image verified.',
      action: 'APPROVED',
    },
    {
      role: 3,
      comment: '60-day credit terms confirmed.',
      action: 'APPROVED',
    },
  ],
  updatedAt: '2026-11-18T10:00:00.000Z',
};

describe('Phase 4: Structured 12-Field Form Builder, Conditional Cheque Fields, Confirm Modal & Read-Only Image Review', () => {
  let vite;
  let ConfirmModal;
  let FormBuilderPanel;
  let FormReviewPanel;

  before(async () => {
    vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });
    ({ ConfirmModal } = await vite.ssrLoadModule('/src/components/ConfirmModal.jsx'));
    ({ FormBuilderPanel } = await vite.ssrLoadModule(
      '/src/components/FormBuilderPanel.jsx'
    ));
    ({ FormReviewPanel } = await vite.ssrLoadModule(
      '/src/components/FormReviewPanel.jsx'
    ));
  });

  after(async () => {
    if (vite) await vite.close();
  });

  it('renders custom ConfirmModal dialog only when isOpen is true', () => {
    const closedHtml = renderToStaticMarkup(
      React.createElement(ConfirmModal, {
        isOpen: false,
        title: 'Hidden Modal',
        description: 'Should not render',
      })
    );
    assert.equal(closedHtml, '');

    const openHtml = renderToStaticMarkup(
      React.createElement(ConfirmModal, {
        isOpen: true,
        title: 'Confirm Form Submission to Stage 2',
        description: 'Final confirmation before saving.',
        summaryItems: [{ label: 'Target Stage', value: 'Stage 2 (INCOMPLETE)' }],
        confirmLabel: 'Confirm Final Submission',
      })
    );
    assert.match(openHtml, /role="dialog"/);
    assert.match(openHtml, /Confirm Form Submission to Stage 2/);
    assert.match(openHtml, /Confirm Final Submission/);
  });

  it('renders all 12 exact form fields and conditional cheque fields when Security Cheque is Y', () => {
    const htmlWithCheque = renderToStaticMarkup(
      React.createElement(FormBuilderPanel, {
        initialForm: REVIEW_SAMPLE_FORM,
        onSave: () => {},
        onCancel: () => {},
      })
    );

    assert.match(htmlWithCheque, /1\. (C\. name|Customer Name)/);
    assert.match(htmlWithCheque, /2\. (B\. name|Business Name)/);
    assert.match(htmlWithCheque, /3\. Shop Picture/);
    assert.match(htmlWithCheque, /4\. Channel/);
    assert.match(htmlWithCheque, /5\. CNIC #/);
    assert.match(htmlWithCheque, /6\. NTN #/);
    assert.match(htmlWithCheque, /7\. Mobile #/);
    assert.match(htmlWithCheque, /8\. Address/);
    assert.match(htmlWithCheque, /9\. Days/);
    assert.match(htmlWithCheque, /10\. Credit limit/);
    assert.match(htmlWithCheque, /11\. Security Cheque/);
    assert.match(htmlWithCheque, /12\. Credit type/);
    assert.match(htmlWithCheque, /C\. no\./);
    assert.match(htmlWithCheque, /C\. Amount/);
    assert.match(htmlWithCheque, /Bank name/);
    assert.match(htmlWithCheque, /Bank Branch \(optional\)/);
    assert.match(htmlWithCheque, /C\. Picture/);
    assert.match(htmlWithCheque, /CHQ-771234/);
    assert.match(htmlWithCheque, /Meezan Bank/);

    const htmlWithoutCheque = renderToStaticMarkup(
      React.createElement(FormBuilderPanel, {
        initialForm: { ...REVIEW_SAMPLE_FORM, chequeStatus: 'No' },
        onSave: () => {},
        onCancel: () => {},
      })
    );
    assert.doesNotMatch(htmlWithoutCheque, /data-testid="conditional-cheque-fields"/);
  });

  it('renders strictly read-only fields with viewable Shop & Cheque images, stacked comments, and stage-gated Approve/Reject', () => {
    const role4Html = renderToStaticMarkup(
      React.createElement(FormReviewPanel, {
        form: REVIEW_SAMPLE_FORM,
        role: 4,
        onReviewSubmit: () => {},
        onClose: () => {},
      })
    );

    assert.match(role4Html, /Form Details/);
    assert.match(role4Html, /alt="Shop Picture"/);
    assert.match(role4Html, /alt="Cheque Picture"/);
    assert.match(
      role4Html,
      /Person 2 Comment: <\/span><span>Shop front and cheque image verified\./
    );
    assert.match(
      role4Html,
      /Person 3 Comment: <\/span><span>60-day credit terms confirmed\./
    );
    assert.match(role4Html, /Approve Stage 4/);
    assert.match(role4Html, /Reject Form/);

    const role2Html = renderToStaticMarkup(
      React.createElement(FormReviewPanel, {
        form: REVIEW_SAMPLE_FORM,
        role: 2,
        onReviewSubmit: () => {},
        onClose: () => {},
      })
    );

    assert.doesNotMatch(role2Html, /Approve Stage/);
    assert.doesNotMatch(role2Html, /Reject Form/);
    assert.match(
      role2Html,
      /READ-ONLY VIEW: Record is currently assigned to Stage 4/
    );

    // Approved form viewed by Person 4 must show "Send Credit" button, and NOT for Person 2
    const approvedForm = {
      ...REVIEW_SAMPLE_FORM,
      currentStage: 5,
      status: 'APPROVED',
    };
    const p4ApprovedHtml = renderToStaticMarkup(
      React.createElement(FormReviewPanel, {
        form: approvedForm,
        role: 4,
        onReviewSubmit: () => {},
        onSendCredit: () => {},
        onClose: () => {},
      })
    );
    assert.match(p4ApprovedHtml, /Send Credit/);

    const p2ApprovedHtml = renderToStaticMarkup(
      React.createElement(FormReviewPanel, {
        form: approvedForm,
        role: 2,
        onReviewSubmit: () => {},
        onSendCredit: () => {},
        onClose: () => {},
      })
    );
    assert.doesNotMatch(p2ApprovedHtml, /Send Credit/);
  });
});
