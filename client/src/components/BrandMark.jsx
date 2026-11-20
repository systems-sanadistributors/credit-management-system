import React from 'react';

export function BrandMark({ className = '' }) {
  return (
    <span className={`ui-brand ${className}`} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 10.5c-1.3-1.4-3.2-2.2-5.3-2.2-3.4 0-5.7 1.8-5.7 4.3 0 2.1 1.5 3.3 4.5 4 2.7.6 3.9 1.4 3.9 3 0 2-2 3.4-5 3.4-2.3 0-4.4-.9-5.7-2.3" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
