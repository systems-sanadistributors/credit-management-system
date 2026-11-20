import React, { createContext, useState, useEffect, useCallback } from 'react';
import {
  fetchCurrentUser,
  loginWithPasskey,
  logoutSession,
} from '../api/authApi.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const verifySession = useCallback(async () => {
    try {
      const data = await fetchCurrentUser();
      setRole(data.authenticated ? data.role : null);
    } catch (_err) {
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  const login = async (passkey) => {
    const data = await loginWithPasskey(passkey);
    setRole(data.role);
    return data.role;
  };

  const logout = async () => {
    await logoutSession();
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
