import axios from 'axios';
import { auth } from './firebase';

const BASE_URL = 'https://airosolve.local:8080';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
});

// Attach the signed-in clinician's Firebase ID token to every request.
// getIdToken() returns a cached token and refreshes it automatically when expired.
client.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function fetchStatus() {
  const { data } = await client.get('/status');
  return data;
}

export async function postEvent(event) {
  const { data } = await client.post('/events', event);
  return data;
}

export async function fetchPleth(sinceMs = null) {
  const params = sinceMs != null ? { since: sinceMs } : {};
  const { data } = await client.get('/pleth', { params });
  return data;  // { samples: [{ts, v}], server_time_ms }
}
