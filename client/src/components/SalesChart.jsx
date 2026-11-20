import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

function formatCurrency(value) {
  const num = Number(value || 0);
  return `PKR ${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function SalesChart({
  customerId = '',
  salesHistory = [],
  summary = null,
  loading = false,
  error = '',
}) {
  const computedTotal =
    summary?.totalSales ??
    salesHistory.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const computedCount = summary?.monthsCount ?? salesHistory.length;
  const computedAverage =
    summary?.averageSales ??
    (computedCount > 0 ? Math.round(computedTotal / computedCount) : 0);

  return (
    <div
      data-testid="sales-history-chart"
      className="ui-card"
    >
      <div className="ui-card-header px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800">
          Sales History
        </span>
        {customerId && (
          <span className="font-mono-tabular text-[11px] font-semibold uppercase text-zinc-600">
            ID: {customerId}
          </span>
        )}
      </div>

      <div className="ui-box grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
        <div className="px-4 py-3">
          <div className="font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Total Sales
          </div>
          <div className="mt-1 font-mono-tabular text-base font-semibold text-zinc-950">
            {formatCurrency(computedTotal)}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Monthly Average
          </div>
          <div className="mt-1 font-mono-tabular text-base font-semibold text-zinc-950">
            {formatCurrency(computedAverage)}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Records
          </div>
          <div className="mt-1 font-mono-tabular text-base font-semibold text-zinc-950">
            {String(computedCount).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="py-10 text-center font-mono-tabular text-xs uppercase tracking-wider text-zinc-500">
            Loading sales history...
          </div>
        ) : error ? (
          <div className="py-8 text-center font-mono-tabular text-xs text-rose-800">
            {error}
          </div>
        ) : salesHistory.length === 0 ? (
          <div className="py-10 text-center font-mono-tabular text-xs text-zinc-500">
            No historical sales records found for this Customer ID
          </div>
        ) : (
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={220}>
              <BarChart
                data={salesHistory}
                margin={{ top: 8, right: 12, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 4" stroke="var(--line-strong)" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fill: 'var(--ink-muted)', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                  axisLine={{ stroke: 'var(--line-strong)' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val) =>
                    Number(val) >= 1000
                      ? `${Math.round(Number(val) / 1000)}k`
                      : String(val)
                  }
                  tick={{ fill: 'var(--ink-muted)', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), 'Sales']}
                  contentStyle={{
                    borderRadius: 16,
                    border: '1.5px solid var(--line-strong)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--ink-primary)',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px',
                    boxShadow: 'var(--shadow-card)',
                  }}
                />
                <Bar dataKey="amount" fill="var(--accent)" radius={[10, 10, 6, 6]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
