import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

const CATEGORIES = [
  { id: 'cannula', label: 'Cannula Issue', icon: '🔌' },
  { id: 'patient', label: 'Patient Issue', icon: '🧑‍⚕️' },
  { id: 'experiment', label: 'Experiment Status', icon: '🧪' },
  { id: 'device', label: 'Device Alert', icon: '⚠️' },
  { id: 'other', label: 'Other', icon: '📝' },
];

export default function ReportEventScreen({ navigation }) {
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!selected) {
      Alert.alert('Select a category', 'Please choose an event type before submitting.');
      return;
    }

    setSubmitting(true);

    const event = {
      category: selected,
      notes: notes.trim(),
      timestamp: new Date().toISOString(),
    };

    // TODO: POST to device API when backend is ready
    console.log('Event reported:', event);

    await new Promise(r => setTimeout(r, 500)); // simulate network
    setSubmitting(false);

    Alert.alert('Event Logged', 'Your report has been recorded.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Report an Event</Text>
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
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
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
  categorySelected: {
    borderColor: colors.primary,
    backgroundColor: '#EAF2FF',
  },
  categoryIcon: { fontSize: 22, marginRight: spacing.sm },
  categoryLabel: { flex: 1, fontSize: 16, color: colors.text },
  categoryLabelSelected: { color: colors.primary, fontWeight: '600' },
  check: { fontSize: 18, color: colors.primary, fontWeight: '700' },
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
  submitButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
