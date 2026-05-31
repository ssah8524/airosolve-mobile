/**
 * AiroSolve API client.
 *
 * Every request carries:
 *   1. Firebase ID token (Bearer) — authenticates the clinician to the Pi.
 *   2. Client TLS certificate     — mTLS; proves this is an authorised app build.
 *
 * When TLS_ENABLED=false (local dev), falls back to the standard fetch API so
 * the app can be tested without cert material.  In production (dev builds
 * distributed to clinicians) TLS is always enabled.
 *
 * Note: react-native-ssl-pinning requires a native dev build — Expo Go will
 * not work. Run `eas build --profile development` to generate a build, or
 * use `npx expo run:ios` / `npx expo run:android` for a local native build.
 */
import { auth } from './firebase';
import { isTlsEnabled } from './tls';

// Production / physical device: HTTPS to the Pi via mDNS hostname.
// Local dev / simulator: plain HTTP to localhost (TLS_ENABLED=false).
const BASE_URL = isTlsEnabled
  ? 'https://airosolve.local:8080'
  : 'http://localhost:8080';
const TIMEOUT_MS = 5000;

// ─── Auth header ─────────────────────────────────────────────────────────────

async function authHeader() {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// ─── Core request helpers ─────────────────────────────────────────────────────

/**
 * Makes an mTLS-aware fetch when TLS is enabled, plain fetch otherwise.
 * Always throws on non-2xx responses.
 */
async function request(path, { method = 'GET', body, params } = {}) {
  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)),
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
  };

  // Standard fetch — works over both HTTP (dev) and HTTPS (production).
  // For HTTPS, iOS uses the system trust store; the Pi's CA cert must be
  // installed on the device as a trusted root profile (one-time setup).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`API ${method} ${path} failed: ${response.status} ${text}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchStatus() {
  return request('/status');
}

export async function postEvent(event) {
  return request('/events', { method: 'POST', body: event });
}

export async function fetchPleth(sinceMs = null) {
  return request('/pleth', { params: sinceMs != null ? { since: sinceMs } : {} });
}

/**
 * Register an Expo push token with the Pi so quality-drop alerts can be
 * delivered to this device.
 *
 * @param {string} token  — Expo push token obtained from `getExpoPushTokenAsync`
 */
export async function postDeviceToken(token) {
  return request('/device-token', { method: 'POST', body: { token } });
}
