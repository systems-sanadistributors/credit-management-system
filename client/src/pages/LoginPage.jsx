import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { BrandMark } from '../components/BrandMark.jsx';

export function LoginPage() {
  const { role, loading, login } = useAuth();
  const navigate = useNavigate();
  const [passkey, setPasskey] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && role) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!passkey.trim()) {
      setError('Enter a passkey.');
      return;
    }

    setSubmitting(true);
    try {
      await login(passkey.trim());
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid passkey.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ui-shell min-h-screen flex flex-col text-zinc-950">
      <header className="ui-nav px-4 sm:px-6 min-h-14 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display font-bold text-sm">
            Sana Distributors
          </span>
        </div>

        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="ui-card w-full max-w-sm">
          <div className="ui-card-header px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-mono-tabular text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Secure Access
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-zinc-950">
                Sign In
              </h1>
            </div>
            <BrandMark />
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {error && (
              <div
                role="alert"
                className="border border-rose-500 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-900"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="passkey-input"
                className="block font-mono-tabular text-xs font-semibold uppercase tracking-wider text-zinc-800 mb-2"
              >
                Passkey
              </label>
              <div className="relative">
                <input
                  id="passkey-input"
                  type={showPasskey ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  placeholder="Enter passkey"
                  className="ledger-input px-3.5 py-2.5 pr-10 font-mono-tabular text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPasskey((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 hover:text-zinc-900 cursor-pointer"
                  aria-label={showPasskey ? 'Hide passkey' : 'Show passkey'}
                  title={showPasskey ? 'Hide passkey' : 'Show passkey'}
                >
                  {showPasskey ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                      <path d="M10.733 5.076A10.744 10.744 0 0 1 12 5c6.5 0 10 7 10 7a18.06 18.06 0 0 1-4.162 4.823" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="ledger-btn-primary w-full py-2.5 px-4 font-display text-xs font-semibold uppercase tracking-widest"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
