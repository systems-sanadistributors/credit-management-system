import { API_BASE, apiRequest } from './client.js';

export const EXPORT_FORMS_URL = `${API_BASE}/forms/export`;

export function fetchForms() {
  return apiRequest('/forms', { method: 'GET' });
}

export function fetchFormById(id) {
  return apiRequest(`/forms/${id}`, { method: 'GET' });
}

export function createForm(payload) {
  const isFormData =
    typeof FormData !== 'undefined' && payload instanceof FormData;
  return apiRequest('/forms', {
    method: 'POST',
    body: isFormData ? payload : JSON.stringify(payload),
  });
}

export function updateForm(id, payload) {
  const isFormData =
    typeof FormData !== 'undefined' && payload instanceof FormData;
  return apiRequest(`/forms/${id}`, {
    method: 'PUT',
    body: isFormData ? payload : JSON.stringify(payload),
  });
}

export function deleteForm(id) {
  return apiRequest(`/forms/${id}`, {
    method: 'DELETE',
  });
}

export function reviewForm(id, payload) {
  return apiRequest(`/forms/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function sendCredit(id) {
  return apiRequest(`/forms/${id}/send-credit`, {
    method: 'POST',
  });
}

export function filterFormsByCategory(forms, filterKey) {
  if (!Array.isArray(forms)) return [];
  switch (filterKey) {
    case 'INCOMPLETE':
      return forms.filter(
        (f) => f.status === 'INCOMPLETE' && f.currentStage >= 2 && f.currentStage <= 4
      );
    case 'COMPLETED':
      return forms.filter((f) => f.currentStage === 5);
    case 'APPROVED':
      return forms.filter((f) => f.status === 'APPROVED');
    case 'REJECTED':
      return forms.filter((f) => f.status === 'REJECTED');
    case 'TOTAL':
    default:
      return forms;
  }
}
