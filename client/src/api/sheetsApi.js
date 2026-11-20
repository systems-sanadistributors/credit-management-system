import { apiRequest } from './client.js';

export function fetchCustomerById(customerId) {
  return apiRequest(`/customers/${encodeURIComponent(String(customerId).trim())}`, {
    method: 'GET',
  });
}

export function fetchSheetsSyncStatus() {
  return apiRequest('/sheets/sync/status', {
    method: 'GET',
  });
}

export async function syncGoogleSheets() {
  const initial = await apiRequest('/sheets/sync?async=1', {
    method: 'POST',
  });

  if (initial.status === 'completed' && initial.result) {
    return initial.result;
  }

  const maxAttempts = 90; // 3 minutes at 2s intervals
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const statusRes = await fetchSheetsSyncStatus();
    if (statusRes.status === 'completed') {
      return statusRes.result;
    }
    if (statusRes.status === 'failed') {
      throw new Error(statusRes.error || 'Google Sheets sync failed');
    }
  }

  throw new Error('Google Sheets sync is taking longer than expected. Please check again shortly.');
}
