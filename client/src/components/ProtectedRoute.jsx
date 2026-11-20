import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export function ProtectedRoute({ children }) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-900 font-mono-tabular text-xs uppercase tracking-widest">
        VERIFYING SESSION CREDENTIALS...
      </div>
    );
  }

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
