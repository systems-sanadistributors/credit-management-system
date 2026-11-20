import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice.js';
import formsReducer from './formsSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    forms: formsReducer,
  },
});
