import { apiRequest } from './client.js';

export function fetchCustomerById(customerId) {
  return apiRequest(`/customers/${encodeURIComponent(String(customerId).trim())}`, {
    method: 'GET',
  });
}

export function syncGoogleSheets() {
  return apiRequest('/sheets/sync', {
    method: 'POST',
  });
}
