import React from 'react';

const STAT_CARDS = [
  { key: 'TOTAL', label: 'Total', prop: 'total' },
  { key: 'INCOMPLETE', label: 'Incomplete', prop: 'incomplete' },
  { key: 'COMPLETED', label: 'Completed', prop: 'completed' },
  { key: 'APPROVED', label: 'Approved', prop: 'approved' },
  { key: 'REJECTED', label: 'Rejected', prop: 'rejected' },
];

export function StatFilterBar({ stats, activeFilter, onSelectFilter }) {
  return (
    <section aria-label="Form status filters" className="ledger-index">
      {STAT_CARDS.map((card) => {
        const isSelected = activeFilter === card.key;
        const count = stats?.[card.prop] ?? 0;

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelectFilter(card.key)}
            aria-pressed={isSelected}
          >
            <span className="ledger-index-count">
              {String(count).padStart(2, '0')}
            </span>
            <span className="ledger-index-label">{card.label}</span>
          </button>
        );
      })}
    </section>
  );
}
