import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { filterFormsByCategory } from '../src/api/formsApi.js';

const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const SAMPLE_FORMS = [
  {
    _id: '673a00000000000000000101',
    title: 'Tariq Mahmood — Al-Noor Pharmacy',
    cName: 'Tariq Mahmood',
    bName: 'Al-Noor Pharmacy',
    shopPicture: SAMPLE_PNG_DATA_URL,
    channel: 'Retail',
    creditLimit: 500000,
    creditType: 'New',
    currentStage: 2,
    status: 'INCOMPLETE',
    isUpdated: false,
    comments: [],
    updatedAt: '2026-11-18T08:00:00.000Z',
  },
  {
    _id: '673a00000000000000000102',
    title: 'Bilal Khan — Khan Medicos',
    cName: 'Bilal Khan',
    bName: 'Khan Medicos',
    shopPicture: SAMPLE_PNG_DATA_URL,
    channel: 'W.S',
    creditLimit: 750000,
    creditType: 'Increment',
    currentStage: 4,
    status: 'INCOMPLETE',
    isUpdated: true,
    comments: [{ role: 2, comment: 'Checked', action: 'APPROVED' }],
    updatedAt: '2026-11-18T08:30:00.000Z',
  },
  {
    _id: '673a00000000000000000103',
    title: 'Usman Ali — Sana Key Accounts Hub',
    cName: 'Usman Ali',
    bName: 'Sana Key Accounts Hub',
    shopPicture: SAMPLE_PNG_DATA_URL,
    channel: 'Key accounts',
    creditLimit: 1200000,
    creditType: 'New',
    currentStage: 5,
    status: 'APPROVED',
    isUpdated: false,
    comments: [
      { role: 2, comment: 'OK', action: 'APPROVED' },
      { role: 3, comment: 'OK', action: 'APPROVED' },
      { role: 4, comment: 'Approved', action: 'APPROVED' },
    ],
    updatedAt: '2026-11-18T09:00:00.000Z',
  },
  {
    _id: '673a00000000000000000104',
    title: 'Zainab — City Traders',
    cName: 'Zainab',
    bName: 'City Traders',
    shopPicture: SAMPLE_PNG_DATA_URL,
    channel: 'S.D',
    creditLimit: 300000,
    creditType: 'Closure',
    currentStage: 3,
    status: 'REJECTED',
    isUpdated: false,
    comments: [{ role: 3, comment: 'Rejected', action: 'REJECTED' }],
    updatedAt: '2026-11-18T09:15:00.000Z',
  },
];

describe('Phase 3: Frontend Auth UI, Dashboard Stat Filters & 1-Per-Row Ledger List', () => {
  let vite;
  let StatFilterBar;
  let FormRowList;
  let TopNav;

  before(async () => {
    vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });
    ({ StatFilterBar } = await vite.ssrLoadModule('/src/components/StatFilterBar.jsx'));
    ({ FormRowList } = await vite.ssrLoadModule('/src/components/FormRowList.jsx'));
    ({ TopNav } = await vite.ssrLoadModule('/src/components/TopNav.jsx'));
  });

  after(async () => {
    if (vite) await vite.close();
  });

  it('accurately filters forms for Total, Incomplete (stages 2-4), Completed (stage 5), Approved, and Rejected', () => {
    assert.equal(filterFormsByCategory(SAMPLE_FORMS, 'TOTAL').length, 4);
    assert.equal(filterFormsByCategory(SAMPLE_FORMS, 'INCOMPLETE').length, 2);
    assert.equal(filterFormsByCategory(SAMPLE_FORMS, 'COMPLETED').length, 1);
    assert.equal(filterFormsByCategory(SAMPLE_FORMS, 'APPROVED').length, 1);
    assert.equal(filterFormsByCategory(SAMPLE_FORMS, 'REJECTED').length, 1);
  });

  it('renders Top Stat Cards with counts and active filter indicator', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatFilterBar, {
        stats: {
          total: 4,
          incomplete: 2,
          completed: 1,
          approved: 1,
          rejected: 1,
        },
        activeFilter: 'INCOMPLETE',
        onSelectFilter: () => {},
      })
    );

    assert.match(html, /Total/);
    assert.match(html, /Incomplete/);
    assert.match(html, /Completed/);
    assert.match(html, /Approved/);
    assert.match(html, /Rejected/);
    assert.match(html, /04/);
    assert.match(html, /02/);
  });

  it('renders 1-per-row FormRowList with role-specific triggers and zero AI-slop classes', () => {
    const p1Html = renderToStaticMarkup(
      React.createElement(FormRowList, {
        forms: SAMPLE_FORMS,
        role: 1,
        onInspectForm: () => {},
        onEditForm: () => {},
        onDeleteForm: () => {},
      })
    );

    const p1TopNav = renderToStaticMarkup(
      React.createElement(TopNav, {
        role: 1,
        onLogout: () => {},
        onNewForm: () => {},
      })
    );

    assert.match(p1TopNav, /\+ New Form/);
    assert.match(p1Html, /Tariq Mahmood — Al-Noor Pharmacy/);
    assert.match(p1Html, /Updated \/ Reset/);
    assert.match(p1Html, /Edit/);
    assert.match(p1Html, /Delete/);
    assert.match(p1Html, /disabled=""[^>]*title="Locked after Person 2 approval"/);
    assert.match(p1Html, /Inspect/);

    const p2Html = renderToStaticMarkup(
      React.createElement(FormRowList, {
        forms: SAMPLE_FORMS,
        role: 2,
        onInspectForm: () => {},
        onEditForm: () => {},
        onDeleteForm: () => {},
      })
    );

    assert.match(p2Html, /Review Gate/);
    assert.doesNotMatch(p2Html, />Edit</);
    assert.doesNotMatch(p2Html, />Delete</);
    assert.doesNotMatch(p2Html, /indigo|purple|violet|backdrop-blur/i);

    const viewerTopNav = renderToStaticMarkup(
      React.createElement(TopNav, {
        role: 5,
        onLogout: () => {},
        onNewForm: null,
        onSyncSheets: null,
      })
    );
    assert.match(viewerTopNav, /Viewer/);
    assert.doesNotMatch(viewerTopNav, /New Form/);
    assert.doesNotMatch(viewerTopNav, /Sync Sheets/);

    const viewerHtml = renderToStaticMarkup(
      React.createElement(FormRowList, {
        forms: SAMPLE_FORMS,
        role: 5,
        onInspectForm: () => {},
        onEditForm: () => {},
        onDeleteForm: () => {},
      })
    );
    assert.match(viewerHtml, /Inspect/);
    assert.doesNotMatch(viewerHtml, /Review Gate/);
    assert.doesNotMatch(viewerHtml, />Edit</);
    assert.doesNotMatch(viewerHtml, />Delete</);
  });
});
