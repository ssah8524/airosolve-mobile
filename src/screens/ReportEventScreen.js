import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing } from '../theme';

const CATEGORIES = [
  { id: 'cannula',      label: 'Cannula Issue',        icon: '🔌' },
  { id: 'patient',      label: 'Patient Issue',        icon: '🧑‍⚕️' },
  { id: 'movement',     label: 'Patient Movement',     icon: '🚶' },
  { id: 'intervention', label: 'Intervention / Drug',  icon: '💊' },
  { id: 'experiment',   label: 'Experiment Status',    icon: '🧪' },
  { id: 'device',       label: 'Device Alert',         icon: '⚠️' },
  { id: 'other',        label: 'Other',                icon: '📝' },
];

const TIME_MODE = { NOW: 'now', CUSTOM: 'custom' };

export default function ReportEventScreen({ route, navigation }) {
  const fromChart   = route.params?.fromChart ?? false;
  const chartTime   = route.params?.timestamp ? new Date(route.params.timestamp) : null;

  const [selected, setSelected]     = useState(null);
  const [notes, setNotes]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeMode, setTimeMode]     = useState(TIME_MODE.NOW);
  const [customTime, setCustomTime] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const resolvedTime = fromChart
    ? chartTime
    : timeMode === TIME_MODE.NOW ? new Date() : customTime;

  const displayTime = fromChart
    ? chartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : timeMode === TIME_MODE.NOW
      ? 'Now'
      : customTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const onPickerChange = (_event, date) => {
    setShowPicker(Platform.OS === 'ios');
    if (date) setCustomTime(date);
  };

  const submit = async () => {
    if (!selected) {
      Alert.alert('Select a category', 'Please choose an event type before submitting.');
      return;
    }
    setSubmitting(true);

    const event = {
      category: selected,
      notes: notes.trim(),
      timestamp: resolvedTime.toISOString(),
      source: fromChart ? 'chart_tap' : 'manual',
    };

    // TODO: POST to device API when backend is ready
    console.log('Event reported:', event);

    await new Promise(r => setTimeout(r, 500));
    setSubmitting(false);

    const categoryLabel = CATEGORIES.find(c => c.id === selected)?.label ?? selected;
    Alert.alert('Event Logged', 'Your report has been recorded.', [
      {
        text: 'OK',
        onPress: () => navigation.navigate('Dashboard', {
          newEvent: { ...event, label: categoryLabel },
        }),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Report an Event</Text>

        {/* Category */}
        <Text style={styles.subheading}>Select a category</Text>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryRow, selected === cat.id && styles.categorySelected]}
            onPress={() => setSelected(cat.id)}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text style={[styles.categoryLabel, selected === cat.id && styles.categoryLabelSelected]}>
              {cat.label}
            </Text>
            {selected === cat.id && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        ))}

        {/* Time — fixed when coming from chart tap, selectable otherwise */}
        <Text style={styles.subheading}>Event time</Text>
        {fromChart ? (
          <View style={[styles.timeDisplay, styles.timeDisplayFixed]}>
            <Text style={styles.timeDisplayText}>🕐  {displayTime}</Text>
            <Text style={styles.timeFromChart}>from waveform</Text>
          </View>
        ) : (
          <>
            <View style={styles.timeModeRow}>
              <TouchableOpacity
                style={[styles.timeModeBtn, timeMode === TIME_MODE.NOW && styles.timeModeBtnSelected]}
                onPress={() => setTimeMode(TIME_MODE.NOW)}
              >
                <Text style={[styles.timeModeBtnText, timeMode === TIME_MODE.NOW && styles.timeModeBtnTextSelected]}>
                  Immediate
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeModeBtn, timeMode === TIME_MODE.CUSTOM && styles.timeModeBtnSelected]}
                onPress={() => { setTimeMode(TIME_MODE.CUSTOM); setShowPicker(true); }}
              >
                <Text style={[styles.timeModeBtnText, timeMode === TIME_MODE.CUSTOM && styles.timeModeBtnTextSelected]}>
                  Set time
                </Text>
              </TouchableOpacity>
            </View>

            {timeMode === TIME_MODE.CUSTOM && (
              <TouchableOpacity style={styles.timeDisplay} onPress={() => setShowPicker(true)}>
                <Text style={styles.timeDisplayText}>🕐  {displayTime}</Text>
                <Text style={styles.timeDisplayEdit}>Edit</Text>
              </TouchableOpacity>
            )}

            {showPicker && (
              <DateTimePicker
                value={customTime}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickerChange}
              />
            )}
          </>
        )}

        {/* Notes */}
        <Text style={styles.subheading}>Notes (optional)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Describe the issue…"
          placeholderTextColor={colors.subtext}
          multiline
          numberOfLines={4}
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={submit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit Report'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  scroll:  { padding: spacing.md },
  heading: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subheading: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.subtext,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  categorySelected:      { borderColor: colors.primary, backgroundColor: '#E8F5E9' },
  categoryIcon:          { fontSize: 22, marginRight: spacing.sm },
  categoryLabel:         { flex: 1, fontSize: 16, color: colors.text },
  categoryLabelSelected: { color: colors.primary, fontWeight: '600' },
  check:                 { fontSize: 18, color: colors.primary, fontWeight: '700' },
  timeModeRow:           { flexDirection: 'row', gap: spacing.sm },
  timeModeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  timeModeBtnSelected:     { borderColor: colors.primary, backgroundColor: '#E8F5E9' },
  timeModeBtnText:         { fontSize: 15, color: colors.subtext },
  timeModeBtnTextSelected: { color: colors.primary, fontWeight: '600' },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  timeDisplayFixed: { borderColor: colors.border },
  timeDisplayText:  { fontSize: 16, color: colors.text },
  timeDisplayEdit:  { fontSize: 14, color: colors.primary, fontWeight: '600' },
  timeFromChart:    { fontSize: 12, color: colors.subtext },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton:   { marginTop: spacing.xl, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: spacing.md, alignItems: 'center' },
  submitDisabled: { opacity: 0.6 },
  submitText:     { color: '#fff', fontSize: 17, fontWeight: '600' },
});
