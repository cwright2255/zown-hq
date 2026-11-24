// components/ProgressGoals.jsx
//
// The goals on the Progress tab. Each goal shows its bar and what is left; a goal the app counts itself (workouts, run distance or calories
// this week or this month) says what it counts and moves on its own. Every goal can be edited or deleted, and one kept by hand can be marked
// complete. Goals that are done sit under the others. It only draws: the screen decides what each button does (editing, confirming a delete)
// and lib/goalTracking.js works out what each goal looks like right now.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { goalSections } from '../lib/goalTracking';
import { GOOD, INK, MID, QUIET, p } from './progressStyles';

function IconButton({ name, label, testID, onPress, color = MID }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={s.iconBtn} onPress={onPress}>
      <Ionicons name={name} size={20} color={color} />
    </Pressable>
  );
}

function GoalRow({ goal, last, onEdit, onComplete, onDelete }) {
  return (
    <View testID={`goal-${goal.id}`} style={[s.goal, last && { marginBottom: 0 }]}>
      <View style={s.head}>
        <View style={s.headText}>
          <View style={s.titleRow}>
            {goal.done ? <Ionicons name="checkmark-circle" size={16} color={GOOD} /> : null}
            <Text style={s.title}>{goal.title}</Text>
          </View>
          {goal.tag ? <Text testID={`goal-tag-${goal.id}`} style={s.tag}>{goal.tag}</Text> : null}
        </View>
        <View style={s.actions}>
          {!goal.tracked && !goal.done ? (
            <IconButton testID={`goal-complete-${goal.id}`} name="checkmark-circle-outline" label={`Mark ${goal.title} complete`} color={GOOD} onPress={() => onComplete(goal.id)} />
          ) : null}
          <IconButton testID={`goal-edit-${goal.id}`} name="create-outline" label={`Edit ${goal.title}`} onPress={() => onEdit(goal.id)} />
          <IconButton testID={`goal-delete-${goal.id}`} name="trash-outline" label={`Delete ${goal.title}`} onPress={() => onDelete(goal.id)} />
        </View>
      </View>
      <View style={p.barBg}>
        <View testID={`goal-fill-${goal.id}`} style={[p.barFill, { width: `${goal.percent}%` }, goal.done && { backgroundColor: GOOD }]} />
      </View>
      <View style={s.detailRow}>
        <Text testID={`goal-progress-${goal.id}`} style={s.detail}>{goal.progressLine}</Text>
        <Text testID={`goal-detail-${goal.id}`} style={[s.extra, goal.done && { color: GOOD, fontWeight: '700' }]}>{goal.detail}</Text>
      </View>
    </View>
  );
}

/**
 * @param {object} props
 * @param {Array} props.goals      the goals from store/goalsStore.js
 * @param {object} props.activity  { workouts, runs, now }: what a goal the app counts is counted from
 * @param {()=>void} props.onAdd
 * @param {(id:string)=>void} props.onEdit
 * @param {(id:string)=>void} props.onComplete
 * @param {(id:string)=>void} props.onDelete
 */
export default function ProgressGoals({ goals, activity, onAdd, onEdit, onComplete, onDelete }) {
  const { active, done } = goalSections(goals, activity);
  return (
    <View testID="progress-goals">
      <View style={p.sectionRow}>
        <Text style={p.sectionTitle}>Active Goals</Text>
        <Pressable testID="goal-add" accessibilityRole="button" accessibilityLabel="Add Goal" hitSlop={8} onPress={onAdd}>
          <Text style={s.addLink}>Add Goal</Text>
        </Pressable>
      </View>
      <View style={p.card}>
        {active.length === 0 ? (
          <Text testID="goals-empty" style={s.empty}>
            {done.length > 0 ? 'Every goal is done. Add another to keep going.' : 'No goals yet. Tap "Add Goal" to set one, like 3 workouts a week.'}
          </Text>
        ) : active.map((g, i) => (
          <GoalRow key={g.id} goal={g} last={i === active.length - 1} onEdit={onEdit} onComplete={onComplete} onDelete={onDelete} />
        ))}

        {done.length > 0 ? (
          <View testID="goals-done" style={s.doneBlock}>
            <Text style={s.doneHeading}>Completed</Text>
            {done.map((g, i) => (
              <GoalRow key={g.id} goal={g} last={i === done.length - 1} onEdit={onEdit} onComplete={onComplete} onDelete={onDelete} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  addLink: { fontSize: 13, fontWeight: '600', color: MID },
  empty: { fontSize: 13, color: QUIET },
  goal: { marginBottom: 18 },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  headText: { flex: 1, paddingRight: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: INK },
  tag: { fontSize: 11, color: QUIET, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  detail: { fontSize: 12, color: MID },
  extra: { fontSize: 12, color: QUIET },
  doneBlock: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  doneHeading: { fontSize: 12, fontWeight: '700', color: QUIET, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
});
