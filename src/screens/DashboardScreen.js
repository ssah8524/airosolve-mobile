import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl, Image, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PlethChart from '../components/PlethChart';
import { colors, spacing } from '../theme';

const fetchDeviceStatus = async () => ({
  spo2: 94,
  flow_lpm: 2.5,
  mode: 'IN_RANGE',
  signal_quality: 'good',
  last_updated: new Date().toLocaleTimeString(),
});

export default function DashboardScreen({ navigation }) {
  const { width, height }           = useWindowDimensions();
  const isLandscape                 = width > height;
  const [status, setStatus]         = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);

  const load = async () => {
    const data = await fetchDeviceStatus();
    setStatus(data);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleChartPress = useCallback((timestamp) => {
    navigation.navigate('ReportEvent', { timestamp: timestamp.toISOString(), fromChart: true });
  }, [navigation]);

  const modeColor = status ? colors.badge[status.mode] ?? colors.primary : colors.subtext;

  // ── Landscape: fullscreen chart only ─────────────────────────────────────
  if (isLandscape) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.landscapeHint}>Tap the waveform to report an event</Text>
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
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>Device Status</Text>

        {status && (
          <View style={[styles.modeBadge, { backgroundColor: modeColor }]}>
            <Text style={styles.modeText}>{status.mode.replace('_', ' ')}</Text>
          </View>
        )}

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

        <Text style={styles.sectionLabel}>Pleth — tap to report  ·  rotate for full view</Text>
        <View
          style={styles.chartContainer}
          onLayout={e => setChartWidth(e.nativeEvent.layout.width)}
        >
          {chartWidth > 0 && (
            <PlethChart width={chartWidth} onChartPress={handleChartPress} />
          )}
        </View>

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
  modeText:   { color: '#fff', fontWeight: '600', fontSize: 14 },
  row:        { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
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
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  reportButtonText:  { color: colors.primary, fontSize: 17, fontWeight: '600' },
  landscapeHint: {
    fontSize: 12,
    color: colors.subtext,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  landscapeChart: {
    flex: 1,
    backgroundColor: colors.card,
  },
});
