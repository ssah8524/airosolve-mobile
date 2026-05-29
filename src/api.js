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
import { fetch as tlsFetch } from 'react-native-ssl-pinning';
import { auth } from './firebase';
import { getTlsOptions, isTlsEnabled } from './tls';

const BASE_URL = 'https://airosolve.local:8080';
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

  const tlsOptions = getTlsOptions();

  if (isTlsEnabled && tlsOptions) {
    // react-native-ssl-pinning fetch — presents client cert + pins server cert.
    // Its response object has .status (number), .bodyString (string), and
    // .json() but NOT the standard Fetch .ok / .text() properties.
    const response = await tlsFetch(url, {
      method,
      timeoutInterval: TIMEOUT_MS,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      ...tlsOptions,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`API ${method} ${path} failed: ${response.status} ${response.bodyString ?? ''}`);
    }
    return typeof response.json === 'function'
      ? response.json()
      : JSON.parse(response.bodyString);
  } else {
    // Plain fetch for local dev (TLS_ENABLED=false).
    const response = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`API ${method} ${path} failed: ${response.status} ${text}`);
    }
    return response.json();
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
