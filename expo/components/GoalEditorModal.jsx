// components/GoalEditorModal.jsx
//
// The form for adding a goal and for editing one, in the look of the app's other prompts (components/PromptModal.jsx): a sheet from the
// bottom with a name, what the app should track (nothing, workouts, run distance or calories, over this week or this month), the target,
// and for a goal kept by hand its unit and how far along it is. What it may save is decided by lib/goalTracking.js parseGoalForm; this
// file only collects the text and shows the error.
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { distanceUnitLabel } from '../lib/distanceUnits';
import { GOAL_METRICS, GOAL_PERIODS, goalFormValues, parseGoalForm } from '../lib/goalTracking';
import { INK, MID, QUIET, p } from './progressStyles';

const TRACKING = [
  { key: '', label: 'By hand' },
  { key: 'workouts', label: 'Workouts' },
  { key: 'runDistance', label: 'Run distance' },
  { key: 'calories', label: 'Calories' },
];

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {object|null} props.goal   the goal being edited, or null for a new one
 * @param {string} props.units       Settings distance units ('imperial' | 'metric'): a new distance goal is kept in miles or kilometres
 * @param {()=>void} props.onCancel
 * @param {(goal:object)=>Promise<void>|void} props.onSave  gets the fields to store (lib/goalTracking.js parseGoalForm)
 */
export default function GoalEditorModal({ visible, goal, units = 'imperial', onCancel, onSave }) {
  const [values, setValues] = useState(goalFormValues(null));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const goalId = goal ? goal.id : null;

  useEffect(() => {
    if (visible) {
      setValues(goalFormValues(goal));
      setError('');
      setSaving(false);
    }
    // The form starts again each time it opens, and for a different goal; typing into it must not reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, goalId]);

  const set = (key) => (text) => setValues((v) => ({ ...v, [key]: text }));
  const tracked = Boolean(GOAL_METRICS[values.metric]);
  const trackedUnit = values.metric === 'runDistance'
    ? (goal && goal.metric === 'runDistance' && goal.unit ? goal.unit : distanceUnitLabel(units))
    : tracked ? GOAL_METRICS[values.metric].unit : '';

  const submit = async () => {
    const parsed = parseGoalForm(values, { units, existing: goal });
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave(parsed.goal);
    } catch (e) {
      setError((e && e.message) || 'The goal could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={s.card} testID="goal-editor">
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.title}>{goal ? 'Edit Goal' : 'New Goal'}</Text>

            <Text style={s.label}>What do you want to achieve?</Text>
            <TextInput testID="goal-title" style={s.input} placeholder="e.g. Lose 10 lbs" placeholderTextColor={QUIET} value={values.title} onChangeText={set('title')} />

            <Text style={s.label}>Who keeps count?</Text>
            <View style={s.chips}>
              {TRACKING.map((t) => {
                const on = values.metric === t.key;
                return (
                  <Pressable
                    key={t.key || 'hand'}
                    testID={`goal-track-${t.key || 'hand'}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[p.chip, on && p.chipOn]}
                    onPress={() => setValues((v) => ({ ...v, metric: t.key }))}
                  >
                    <Text style={[p.chipText, on && p.chipTextOn]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text testID="goal-track-help" style={s.help}>
              {tracked ? 'The app counts it from your workouts and runs, so it moves on its own.' : 'You update how far along it is yourself.'}
            </Text>

            {tracked ? (
              <>
                <Text style={s.label}>Over</Text>
                <View style={s.chips}>
                  {Object.entries(GOAL_PERIODS).map(([key, period]) => {
                    const on = values.period === key;
                    return (
                      <Pressable
                        key={key}
                        testID={`goal-period-${key}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        style={[p.chip, on && p.chipOn]}
                        onPress={() => setValues((v) => ({ ...v, period: key }))}
                      >
                        <Text style={[p.chipText, on && p.chipTextOn]}>{period.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text style={s.label}>{tracked ? `Target (${trackedUnit})` : 'What\'s your target number?'}</Text>
            <TextInput testID="goal-target" style={s.input} placeholder={tracked ? 'e.g. 3' : 'e.g. 10'} placeholderTextColor={QUIET} keyboardType="numeric" value={values.target} onChangeText={set('target')} />

            {!tracked ? (
              <>
                <Text style={s.label}>Unit for this goal</Text>
                <TextInput testID="goal-unit" style={s.input} placeholder="e.g. lbs, workouts, km" placeholderTextColor={QUIET} value={values.unit} onChangeText={set('unit')} />
                <Text style={s.label}>How far along are you?</Text>
                <TextInput testID="goal-current" style={s.input} placeholder="0" placeholderTextColor={QUIET} keyboardType="numeric" value={values.current} onChangeText={set('current')} />
              </>
            ) : null}

            {error ? <Text testID="goal-error" accessibilityRole="alert" style={s.error}>{error}</Text> : null}

            <View style={s.btnRow}>
              <Pressable testID="goal-cancel" accessibilityRole="button" style={s.secondaryBtn} onPress={onCancel}>
                <Text style={s.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable testID="goal-save" accessibilityRole="button" style={[s.primaryBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
                <Text style={s.primaryText}>{goal ? 'Save Changes' : 'Save Goal'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36, maxHeight: '88%' },
  title: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: MID, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#1A1A2E' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  help: { fontSize: 12, color: QUIET, marginTop: 8 },
  error: { fontSize: 13, color: '#EF4444', marginTop: 14 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  secondaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#F0F0F0' },
  secondaryText: { fontSize: 14, fontWeight: '600', color: MID },
  primaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: INK },
  primaryText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});
