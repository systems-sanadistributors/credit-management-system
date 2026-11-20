import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchForms } from '../api/formsApi.js';

function computeStats(forms) {
  return {
    total: forms.length,
    incomplete: forms.filter((f) => f.status === 'INCOMPLETE').length,
    completed: forms.filter((f) => f.currentStage === 5).length,
    approved: forms.filter((f) => f.status === 'APPROVED').length,
    rejected: forms.filter((f) => f.status === 'REJECTED').length,
  };
}

export const fetchFormsThunk = createAsyncThunk(
  'forms/fetchForms',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchForms();
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to load forms');
    }
  }
);

const formsSlice = createSlice({
  name: 'forms',
  initialState: {
    items: [],
    stats: {
      total: 0,
      incomplete: 0,
      completed: 0,
      approved: 0,
      rejected: 0,
    },
    loading: true,
    error: null,
  },
  reducers: {
    upsertFormFromStream(state, action) {
      const incoming = action.payload;
      if (!incoming || !incoming._id) return;
      const idx = state.items.findIndex((f) => f._id === incoming._id);
      if (idx >= 0) {
        state.items[idx] = incoming;
      } else {
        state.items.unshift(incoming);
      }
      state.items.sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      );
      state.stats = computeStats(state.items);
    },
    removeFormFromStream(state, action) {
      const deletedId = action.payload;
      state.items = state.items.filter((f) => f._id !== deletedId);
      state.stats = computeStats(state.items);
    },
    clearFormsState(state) {
      state.items = [];
      state.stats = {
        total: 0,
        incomplete: 0,
        completed: 0,
        approved: 0,
        rejected: 0,
      };
      state.loading = true;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFormsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFormsThunk.fulfilled, (state, action) => {
        state.items = action.payload.forms || [];
        state.stats = action.payload.stats || computeStats(state.items);
        state.loading = false;
      })
      .addCase(fetchFormsThunk.rejected, (state, action) => {
        state.error = action.payload || 'Failed to load forms';
        state.loading = false;
      });
  },
});

export const {
  upsertFormFromStream,
  removeFormFromStream,
  clearFormsState,
} = formsSlice.actions;

export default formsSlice.reducer;
