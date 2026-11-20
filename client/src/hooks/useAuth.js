import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, logoutUser } from '../store/authSlice.js';
import { clearFormsState } from '../store/formsSlice.js';

export function useAuth() {
  const dispatch = useDispatch();
  const { role, loading } = useSelector((state) => state.auth);

  const login = useCallback(
    async (passkey) => {
      return dispatch(loginUser(passkey)).unwrap();
    },
    [dispatch]
  );

  const logout = useCallback(async () => {
    await dispatch(logoutUser()).unwrap();
    dispatch(clearFormsState());
  }, [dispatch]);

  return { role, loading, login, logout };
}
