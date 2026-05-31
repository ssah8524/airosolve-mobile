import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Modal,
  ScrollView, RefreshControl, Image, Dimensions,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import PlethChart from '../components/PlethChart';
import { fetchStatus, postEvent, postDeviceToken } from '../api';
import { initNotifications, useForegroundAlerts } from '../notifications';
import { colors, spacing } from '../theme';

// Clinician-selectable causes shown in the quality alert modal.
// Each maps to an existing event category so the CSV log stays consistent.
const QUALITY_CAUSES = [
  { label: 'Sensor Displaced', category: 'device'    },
  { label: 'Patient Movement', category: 'movement'  },
  { label: 'Low Perfusion',    category: 'patient'   },
  { label: 'Motion Artifact',  category: 'movement'  },
];

const STATUS_COLORS = {
  normal:       colors.success,
  cannula:      colors.warning,
  patient:      colors.warning,
  movement:     colors.warning,
  intervention: colors.warning,
  experiment:   colors.primary,
  device:       colors.danger,
  other:        colors.subtext,
};

const fetchDeviceStatus = async () => {
  try {
    const data = await fetchStatus();
    return {
      ...data.vitals,
      last_updated: new Date().toLocaleTimeString(),
    };
  } catch {
    return null;  // device unreachable — show dashes
  }
};

export default function DashboardScreen({ navigation, route }) {
  const [rootDims, setRootDims]         = useState(Dimensions.get('window'));
  const isLandscape                     = rootDims.width > rootDims.height;
  const [status, setStatus]             = useState(null);
  const [refreshing, setRefreshing]     = useState(false);
  const [chartWidth, setChartWidth]     = useState(0);
  const [currentEvent, setCurrentEvent] = useState({
    category: 'normal',
    label: 'Normal',
    timestamp: new Date().toISOString(),
  });
  // True while the quality alert modal is open.
  const [qualityModalVisible, setQualityModalVisible] = useState(false);
  // Tracks the last seen signal_quality to detect good → bad transitions.
  const prevSignalQualityRef = useRef(null);

  const load = useCallback(async () => {
    const data = await fetchDeviceStatus();
    setStatus(data);

    if (data) {
      const newQ = data.signal_quality;
      // Raise the modal whenever quality transitions to bad.
      if (newQ === 'bad' && prevSignalQualityRef.current !== 'bad') {
        setQualityModalVisible(true);
      }
      // Auto-clear the modal once the Pi reports quality as good again.
      if (newQ === 'good') {
        setQualityModalVisible(false);
      }
      prevSignalQualityRef.current = newQ;
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [load]);

  // Register this device for push notifications once on mount.
  useEffect(() => {
    initNotifications(postDeviceToken);
  }, []);

  // Handle foreground notifications: quality_drop raises the cause modal;
  // all other notification types fall back to a simple alert banner.
  useEffect(() => {
    const handleFallback = useForegroundAlerts();
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const { data } = notification.request.content;
      if (data?.type === 'quality_drop') {
        setQualityModalVisible(true);
      } else {
        handleFallback(notification);
      }
    });
    return () => subscription.remove();
  }, []);

  // Practitioner selected a cause: log the event and update Current Status.
  const handleQualityCause = useCallback(async (cause) => {
    setQualityModalVisible(false);
    const event = {
      category:  cause.category,
      label:     cause.label,
      timestamp: new Date().toISOString(),
      source:    'quality_alert',
      notes:     '',
    };
    setCurrentEvent(event);
    try { await postEvent(event); } catch { /* best-effort — alert already dismissed */ }
  }, []);

  // Practitioner chose to override: dismiss on this device only, no event logged.
  const handleQualityOverride = useCallback(() => {
    setQualityModalVisible(false);
  }, []);

  // Receive new events navigated back from ReportEventScreen
  useEffect(() => {
    if (route.params?.newEvent) {
      setCurrentEvent(route.params.newEvent);
      navigation.setParams({ newEvent: undefined });
    }
  }, [route.params?.newEvent]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleChartPress = useCallback((timestamp) => {
    navigation.navigate('ReportEvent', { timestamp: timestamp.toISOString(), fromChart: true });
  }, [navigation]);

  const modeColor = status ? colors.badge[status.mode] ?? colors.primary : colors.subtext;
  const statusColor = STATUS_COLORS[currentEvent.category] ?? colors.subtext;
  const statusTime  = new Date(currentEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Landscape: fullscreen chart only ─────────────────────────────────────
  const onRootLayout = useCallback((e) => {
    setRootDims(e.nativeEvent.layout);
  }, []);

  if (isLandscape) {
    return (
      <SafeAreaView style={styles.safe} onLayout={onRootLayout}>
        <Text style={styles.landscapeHint}>Touch and drag to select event time · drag to edges to scroll back in time</Text>
        <View
          style={styles.landscapeChart}
          onLayout={e => setChartWidth(e.nativeEvent.layout.width)}
        >
          {chartWidth > 0 && (
            <PlethChart width={chartWidth} onChartPress={handleChartPress} landscape />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Portrait: full dashboard ──────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} onLayout={onRootLayout}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.subtitle}>Device Status</Text>

        {status && (
          <View style={[styles.modeBadge, { backgroundColor: modeColor }]}>
            <Text style={styles.modeText}>{status.mode.replace('_', ' ')}</Text>
          </View>
        )}

        {/* Vitals */}
        <View style={styles.row}>
          <MetricCard label="SpO₂"    value={status ? `${status.spo2}%`        : '—'} color={colors.success} />
          <MetricCard label="O₂ Flow" value={status ? `${status.flow_lpm} LPM` : '—'} color={colors.primary} />
          <MetricCard label="Updated" value={status?.last_updated ?? '—'}              color={colors.subtext} />
        </View>

        {/* Current status */}
        <View style={[styles.statusCard, { borderLeftColor: statusColor }]}>
          <View style={styles.statusCardRow}>
            <View>
              <Text style={styles.statusCardLabel}>Current Status</Text>
              <Text style={[styles.statusCardValue, { color: statusColor }]}>{currentEvent.label}</Text>
              <Text style={styles.statusCardTime}>since {statusTime}</Text>
            </View>
            {currentEvent.category !== 'normal' && (
              <TouchableOpacity
                style={styles.resolveButton}
                onPress={async () => {
                  const resolved = {
                    category:  'normal',
                    label:     'Normal',
                    timestamp: new Date().toISOString(),
                    source:    'app',
                    notes:     '',
                  };
                  setCurrentEvent(resolved);
                  try { await postEvent(resolved); } catch { /* best-effort */ }
                }}
              >
                <Text style={styles.resolveButtonText}>✓  Mark Resolved</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Pleth chart */}
        <Text style={styles.sectionLabel}>Pleth — drag to report · rotate for full view</Text>
        <View
          style={styles.chartContainer}
          onLayout={e => setChartWidth(e.nativeEvent.layout.width)}
        >
          {chartWidth > 0 && (
            <PlethChart width={chartWidth} onChartPress={handleChartPress} />
          )}
        </View>

        {/* Fallback button */}
        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => navigation.navigate('ReportEvent', {})}
        >
          <Text style={styles.reportButtonText}>+ Report Event</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Quality alert modal ──────────────────────────────────────────── */}
      <Modal
        visible={qualityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleQualityOverride}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>⚠</Text>
            <Text style={styles.modalTitle}>Signal Quality Alert</Text>
            <Text style={styles.modalBody}>
              The device detected poor pleth signal quality. Select the most
              likely cause to log it, or override to dismiss this alert on
              your device only.
            </Text>

            <View style={styles.causeGrid}>
              {QUALITY_CAUSES.map((cause) => (
                <TouchableOpacity
                  key={cause.label}
                  style={styles.causeButton}
                  onPress={() => handleQualityCause(cause)}
                >
                  <Text style={styles.causeButtonText}>{cause.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.overrideButton}
              onPress={handleQualityOverride}
            >
              <Text style={styles.overrideButtonText}>
                Override — Dismiss on This Device Only
              </Text>
            </TouchableOpacity>

            <Text style={styles.modalDisclaimer}>
              The device display will continue to show the alert regardless of
              this action. The signal quality log is always based on device
              readings.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.background },
  scroll:   { padding: spacing.md },
  logo:     { width: 200, height: 60, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.subtext, marginBottom: spacing.md },
  modeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  modeText:  { color: '#fff', fontWeight: '600', fontSize: 14 },
  row:       { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLabel: { fontSize: 12, color: colors.subtext, marginBottom: spacing.xs },
  cardValue: { fontSize: 22, fontWeight: '700' },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statusCardRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusCardLabel: { fontSize: 12, color: colors.subtext, marginBottom: spacing.xs },
  statusCardValue: { fontSize: 20, fontWeight: '700' },
  statusCardTime:  { fontSize: 12, color: colors.subtext, marginTop: 2 },
  resolveButton: {
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  resolveButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chartContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: spacing.md,
  },
  reportButton: {
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  reportButtonText: { color: colors.primary, fontSize: 17, fontWeight: '600' },
  landscapeHint: {
    fontSize: 11,
    color: colors.subtext,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  landscapeChart: { flex: 1, backgroundColor: colors.card },

  // ── Quality alert modal ────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalIcon: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalBody: {
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  causeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  causeButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.warning + '22',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.warning,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  causeButtonText: {
    color: colors.warning,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  overrideButton: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.subtext,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  overrideButtonText: {
    color: colors.subtext,
    fontWeight: '600',
    fontSize: 14,
  },
  modalDisclaimer: {
    fontSize: 12,
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
