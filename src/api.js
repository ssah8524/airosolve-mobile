import axios from 'axios';

const BASE_URL = 'http://airosolve.local:8080';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
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
