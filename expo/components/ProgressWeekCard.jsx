// components/ProgressWeekCard.jsx
//
// "This Week" at the top of the Progress tab: the workouts, runs and calories since Monday, the streak, and the seven days with the ones the
// person trained on filled in. It only draws what it is given; the numbers come from lib/progressInsights.js (weekSummary, weekStrip) and
// the streak from services/streakService.js.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INK, MID, QUIET, p } from './progressStyles';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * @param {object} props
 * @param {{workouts:number, runs:number, calories:number}} props.summary  lib/progressInsights.js weekSummary
 * @param {Array} props.strip      lib/progressInsights.js weekStrip: Monday to Sunday
 * @param {number} props.streak    days in a row with a workout, a run or a hike
 */
export default function ProgressWeekCard({ summary, strip, streak }) {
  const tiles = [
    { key: 'workouts', value: String(summary.workouts), label: 'Workouts' },
    { key: 'runs', value: String(summary.runs), label: 'Runs' },
    { key: 'calories', value: summary.calories.toLocaleString('en-US'), label: 'Calories' },
    { key: 'streak', value: String(streak), label: 'Day streak' },
  ];
  const trained = strip.filter((d) => d.active).length;
  return (
    <View testID="progress-week">
      <View style={p.sectionRow}><Text style={p.sectionTitle}>This Week</Text></View>
      <View style={p.card}>
        <View style={s.tiles}>
          {tiles.map((t) => (
            <View key={t.key} style={s.tile} accessible accessibilityLabel={`${t.label}: ${t.value}`}>
              <Text testID={`week-${t.key}`} style={s.value}>{t.value}</Text>
              <Text style={s.label}>{t.label}</Text>
            </View>
          ))}
        </View>
        <View style={s.strip}>
          {strip.map((day, i) => (
            <View
              key={day.key}
              testID={`week-day-${day.key}`}
              style={s.day}
              accessible
              accessibilityLabel={`${DAY_NAMES[i]}${day.today ? ', today' : ''}: ${day.active ? 'trained' : day.future ? 'still to come' : 'no session'}`}
            >
              <View style={[s.dot, day.future && s.dotFuture, day.today && s.dotToday, day.active && s.dotOn]}>
                {day.active ? <Ionicons name="checkmark" size={14} color="#FFF" /> : null}
              </View>
              <Text style={[s.letter, day.today && s.letterToday]}>{day.letter}</Text>
            </View>
          ))}
        </View>
        <Text testID="week-caption" style={s.caption}>
          {trained === 0 ? 'Nothing yet this week. A workout or a run fills in a day.' : `${trained} of 7 days trained this week`}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  tiles: { flexDirection: 'row' },
  tile: { flex: 1, alignItems: 'center' },
  value: { fontSize: 22, fontWeight: '800', color: INK },
  label: { fontSize: 11, color: QUIET, marginTop: 2 },
  strip: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 4 },
  day: { alignItems: 'center', width: 36 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E5E5', alignItems: 'center', justifyContent: 'center' },
  dotFuture: { backgroundColor: '#F0F0F0' },
  dotToday: { borderWidth: 2, borderColor: INK, backgroundColor: '#FFF' },
  dotOn: { backgroundColor: INK, borderColor: INK },
  letter: { fontSize: 11, color: QUIET, marginTop: 4 },
  letterToday: { color: INK, fontWeight: '700' },
  caption: { fontSize: 12, color: MID, textAlign: 'center', marginTop: 12 },
});
