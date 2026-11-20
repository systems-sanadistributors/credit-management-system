import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

describe('Phase 3 (Frontend Sheets UI): Customer ID Lookup, SalesChart & Sync Sheets Trigger', () => {
  let vite;
  let SalesChart;
  let FormBuilderPanel;
  let buildPartialAutoFillUpdates;
  let FormReviewPanel;
  let TopNav;

  before(async () => {
    vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });
    ({ SalesChart } = await vite.ssrLoadModule('/src/components/SalesChart.jsx'));
    ({ FormBuilderPanel, buildPartialAutoFillUpdates } = await vite.ssrLoadModule(
      '/src/components/FormBuilderPanel.jsx'
    ));
    ({ FormReviewPanel } = await vite.ssrLoadModule('/src/components/FormReviewPanel.jsx'));
    ({ TopNav } = await vite.ssrLoadModule('/src/components/TopNav.jsx'));
  });

  after(async () => {
    if (vite) await vite.close();
  });

  it('renders SalesChart KPI strip and empty state cleanly with zero banned AI-slop classes', () => {
    const emptyHtml = renderToStaticMarkup(
      React.createElement(SalesChart, {
        customerId: 'CUST-0001',
        salesHistory: [],
        summary: { totalSales: 0, averageSales: 0, monthsCount: 0 },
      })
    );

    assert.match(emptyHtml, /Sales History/);
    assert.match(emptyHtml, /ID: CUST-0001/);
    assert.match(emptyHtml, /Total Sales/);
    assert.match(emptyHtml, /Monthly Average/);
    assert.match(emptyHtml, /Records/);
    assert.match(
      emptyHtml,
      /No historical sales records found for this Customer ID/
    );
    assert.doesNotMatch(emptyHtml, /indigo|purple|violet|backdrop-blur/i);

    const populatedHtml = renderToStaticMarkup(
      React.createElement(SalesChart, {
        customerId: 'CUST-0002',
        salesHistory: [
          { period: '2026-01', amount: 150000 },
          { period: '2026-02', amount: 250000 },
        ],
        summary: { totalSales: 400000, averageSales: 200000, monthsCount: 2 },
      })
    );
    assert.match(populatedHtml, /PKR 400,000/);
    assert.match(populatedHtml, /PKR 200,000/);
    assert.match(populatedHtml, /02/);
  });

  it('renders Customer ID auto-fill bar with Fetch Data button in FormBuilderPanel', () => {
    const html = renderToStaticMarkup(
      React.createElement(FormBuilderPanel, {
        initialForm: null,
        onSave: () => {},
        onCancel: () => {},
      })
    );

    assert.match(html, /id="field-customer-id"/);
    assert.match(html, /Customer ID/);
    assert.match(html, /Fetch Data/);

    // Verify partial auto-fill only returns populated common fields and omits missing/dashboard-only fields
    const partial = buildPartialAutoFillUpdates({
      customerId: 'DYN-900',
      customerName: 'Ahsan Tariq',
      businessName: 'Tariq Enterprises',
      channel: 'w.s',
      cnic: '35202-9009009-1',
      ntn: '',
      mobile: '0322-9009009',
      address: 'Plot 4, Faisalabad',
      days: '30',
      creditLimit: null,
      email: 'ignored@example.com',
    });

    assert.deepEqual(partial, {
      cName: 'Ahsan Tariq',
      bName: 'Tariq Enterprises',
      channel: 'W.S',
      cnicNo: '35202-9009009-1',
      mobileNo: '0322-9009009',
      address: 'Plot 4, Faisalabad',
      days: '30',
    });
    assert.equal('creditLimit' in partial, false);
    assert.equal('ntnNo' in partial, false);
    assert.equal('email' in partial, false);
  });

  it('renders SalesChart automatically in FormReviewPanel when form has customerId', () => {
    const baseForm = {
      _id: '673a00000000000000000555',
      title: 'Ali — Ali Mart',
      cName: 'Ali',
      bName: 'Ali Mart',
      shopPicture: 'https://pub-c0f18d66c6594793887ffbb5106daeb2.r2.dev/a.png',
      channel: 'Retail',
      cnicNo: '35202-1111111-1',
      ntnNo: '',
      mobileNo: '0300-1111111',
      address: 'Lahore',
      days: '30',
      creditLimit: 500000,
      chequeStatus: 'No',
      creditType: 'New',
      currentStage: 2,
      status: 'INCOMPLETE',
      comments: [],
    };

    const withIdHtml = renderToStaticMarkup(
      React.createElement(FormReviewPanel, {
        form: { ...baseForm, customerId: 'CUST-555' },
        role: 2,
        onReviewSubmit: () => {},
        onClose: () => {},
      })
    );
    assert.match(withIdHtml, /CUST-555/);
    assert.match(withIdHtml, /data-testid="sales-history-chart"/);

    const withoutIdHtml = renderToStaticMarkup(
      React.createElement(FormReviewPanel, {
        form: { ...baseForm, customerId: '' },
        role: 2,
        onReviewSubmit: () => {},
        onClose: () => {},
      })
    );
    assert.doesNotMatch(withoutIdHtml, /data-testid="sales-history-chart"/);
  });

  it('renders Sync Sheets button in TopNav for Person 1 only', () => {
    const p1Html = renderToStaticMarkup(
      React.createElement(TopNav, {
        role: 1,
        onLogout: () => {},
        onNewForm: () => {},
        onSyncSheets: () => {},
      })
    );
    assert.match(p1Html, /Sync Sheets/);

    for (const role of [2, 3, 4]) {
      const checkerHtml = renderToStaticMarkup(
        React.createElement(TopNav, {
          role,
          onLogout: () => {},
          onNewForm: null,
          onSyncSheets: null,
        })
      );
      assert.doesNotMatch(checkerHtml, /Sync Sheets/);
    }
  });
});
