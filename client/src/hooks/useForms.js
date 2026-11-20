import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchFormsThunk,
  upsertFormFromStream,
  removeFormFromStream,
} from '../store/formsSlice.js';

export function useForms() {
  const dispatch = useDispatch();
  const { items: forms, stats, loading, error } = useSelector(
    (state) => state.forms
  );

  const reload = useCallback(() => {
    return dispatch(fetchFormsThunk()).unwrap();
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchFormsThunk());

    let source = null;
    let reconnectTimer = null;
    let disposed = false;

    const connectStream = () => {
      if (disposed) return;

      source = new EventSource('/api/forms/stream', {
        withCredentials: true,
      });

      source.addEventListener('form_upserted', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.form) {
            dispatch(upsertFormFromStream(data.form));
          }
        } catch (_err) {
          // ignore malformed frames
        }
      });

      source.addEventListener('form_deleted', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.id) {
            dispatch(removeFormFromStream(data.id));
          }
        } catch (_err) {
          // ignore malformed frames
        }
      });

      source.onerror = () => {
        if (source) {
          source.close();
          source = null;
        }
        if (!disposed && !reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectStream();
          }, 3000);
        }
      };
    };

    connectStream();

    return () => {
      disposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (source) {
        source.close();
      }
    };
  }, [dispatch]);

  return { forms, stats, loading, error, reload };
}
