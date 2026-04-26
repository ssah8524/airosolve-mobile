import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

// Mock device status — replace with real API call when backend is ready
const fetchDeviceStatus = async () => ({
  spo2: 94,
  flow_lpm: 2.5,
  mode: 'IN_RANGE',
  signal_quality: 'good',
  last_updated: new Date().toLocaleTimeString(),
});

export default function DashboardScreen({ navigation }) {
  const [status, setStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const modeColor = status ? colors.badge[status.mode] ?? colors.primary : colors.subtext;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>AiroSolve</Text>
        <Text style={styles.subtitle}>Device Status</Text>

        {status ? (
          <>
            {/* Mode badge */}
            <View style={[styles.modeBadge, { backgroundColor: modeColor }]}>
              <Text style={styles.modeText}>{status.mode.replace('_', ' ')}</Text>
            </View>

            {/* Vitals cards */}
            <View style={styles.row}>
              <MetricCard label="SpO₂" value={`${status.spo2}%`} color={colors.success} />
              <MetricCard label="O₂ Flow" value={`${status.flow_lpm} LPM`} color={colors.primary} />
            </View>

            <View style={styles.row}>
              <MetricCard
                label="Signal"
                value={status.signal_quality.toUpperCase()}
                color={status.signal_quality === 'good' ? colors.success : colors.danger}
              />
              <MetricCard label="Updated" value={status.last_updated} color={colors.subtext} />
            </View>
          </>
        ) : (
          <Text style={styles.loading}>Connecting to device…</Text>
        )}

        {/* Report button */}
        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => navigation.navigate('ReportEvent')}
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
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.subtext,
    marginBottom: spacing.lg,
  },
  modeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  modeText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
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
  loading: { color: colors.subtext, marginTop: spacing.xl, textAlign: 'center' },
  reportButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  reportButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
