import { apiRequest } from './client.js';

export function loginWithPasskey(passkey) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ passkey }),
  });
}

export function logoutSession() {
  return apiRequest('/auth/logout', {
    method: 'POST',
  });
}

export function fetchCurrentUser() {
  return apiRequest('/auth/session', {
    method: 'GET',
  });
}
