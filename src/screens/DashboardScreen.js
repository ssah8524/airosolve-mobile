import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl, Image, Dimensions,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import PlethChart from '../components/PlethChart';
import { fetchStatus } from '../api';
import { colors, spacing } from '../theme';

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
  const [rootDims, setRootDims]       = useState(Dimensions.get('window'));
  const isLandscape                   = rootDims.width > rootDims.height;
  const [status, setStatus]           = useState(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [chartWidth, setChartWidth]   = useState(0);
  const [currentEvent, setCurrentEvent] = useState({
    category: 'normal',
    label: 'Normal',
    timestamp: new Date().toISOString(),
  });

  const load = async () => {
    const data = await fetchDeviceStatus();
    setStatus(data);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
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
        </View>
        <View style={styles.row}>
          <MetricCard
            label="Signal"
            value={status ? status.signal_quality.toUpperCase() : '—'}
            color={status?.signal_quality === 'good' ? colors.success : colors.danger}
          />
          <MetricCard label="Updated" value={status?.last_updated ?? '—'} color={colors.subtext} />
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
                onPress={() => setCurrentEvent({
                  category: 'normal',
                  label: 'Normal',
                  timestamp: new Date().toISOString(),
                })}
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
});
