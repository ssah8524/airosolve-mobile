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
