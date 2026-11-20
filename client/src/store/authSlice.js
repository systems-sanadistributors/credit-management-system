import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  fetchCurrentUser,
  loginWithPasskey,
  logoutSession,
} from '../api/authApi.js';

export const checkSession = createAsyncThunk('auth/checkSession', async () => {
  const data = await fetchCurrentUser();
  return data.authenticated ? data.role : null;
});

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (passkey, { rejectWithValue }) => {
    try {
      const data = await loginWithPasskey(passkey);
      return data.role;
    } catch (err) {
      return rejectWithValue(err.message || 'Invalid passkey.');
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  await logoutSession();
  return null;
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    role: null,
    loading: true,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(checkSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkSession.fulfilled, (state, action) => {
        state.role = action.payload;
        state.loading = false;
      })
      .addCase(checkSession.rejected, (state) => {
        state.role = null;
        state.loading = false;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.role = action.payload;
        state.loading = false;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.role = null;
      });
  },
});

export default authSlice.reducer;
