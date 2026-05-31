/**
 * Push notification setup for AiroSolve.
 *
 * Call `initNotifications(postToken)` once on app startup.
 * It requests permission, obtains the Expo push token, and POSTs it to the Pi.
 * Foreground notifications are shown as native alert banners.
 *
 * Background notification taps navigate to ReportEvent — wire up
 * `initBackgroundTapHandler(navigation)` once after the navigator is ready.
 */
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Show foreground notifications as alert banners with sound.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

/**
 * Request push permission, obtain the Expo push token, and register it with
 * the Pi by calling `postToken`.
 *
 * @param {(token: string) => Promise<void>} postToken  — async fn that POSTs
 *        the token to the Pi's /device-token endpoint.
 */
export async function initNotifications(postToken) {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[notifications] Push permission denied');
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await postToken(token);
    // Log only a prefix — the full token is PHI-adjacent (links device to subject).
    console.log('[notifications] Push token registered:', token.slice(0, 30) + '...');

    // Android requires an explicit notification channel for alerts.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('airosolve-alerts', {
        name:       'AiroSolve Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        sound:      'default',
      });
    }
  } catch (err) {
    console.warn('[notifications] Setup failed:', err?.message ?? err);
  }
}

/**
 * Returns a handler function for foreground notifications that shows an
 * Alert dialog. Pass the result to
 * `Notifications.addNotificationReceivedListener`.
 *
 * Callers that want a "Report Event" action should use
 * `addQualityDropListener` instead — it provides richer navigation support.
 *
 * @returns {(notification: import('expo-notifications').Notification) => void}
 */
export function useForegroundAlerts() {
  return (notification) => {
    const { title, body } = notification.request.content;
    Alert.alert(title ?? 'AiroSolve Alert', body ?? '', [
      { text: 'Dismiss' },
    ]);
  };
}

/**
 * Wire up a background-tap handler so that tapping a push notification while
 * the app is closed or backgrounded navigates to the ReportEvent screen.
 *
 * Call once after the navigator is mounted. Returns a cleanup function.
 *
 * @param {object} navigation  — React Navigation navigation object
 * @returns {() => void} cleanup — call on unmount to remove the listener
 */
export function initBackgroundTapHandler(navigation) {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const { data } = response.notification.request.content;
      if (data?.type === 'quality_drop') {
        navigation.navigate('ReportEvent', {
          timestamp: new Date().toISOString(),
          fromAlert: true,
        });
      }
    },
  );
  return () => subscription.remove();
}
