/**
 * TLS configuration for the AiroSolve mobile app.
 *
 * The app connects to the Pi over standard HTTPS (TLS 1.2+).  iOS uses the
 * system certificate trust store, so the Pi's CA certificate must be installed
 * on the device as a trusted root profile (one-time setup — see README).
 *
 * Full mTLS cert-pinning via react-native-ssl-pinning is stubbed out here for
 * a future build once we have a proper Expo config plugin to copy certs into
 * the native bundle at the locations the library expects.
 */
import Constants from 'expo-constants';

const { tlsEnabled } = Constants.expoConfig.extra ?? {};

/** True when the app should connect over HTTPS (always true in production). */
export const isTlsEnabled = Boolean(tlsEnabled);
