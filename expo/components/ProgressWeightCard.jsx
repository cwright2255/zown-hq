// components/ProgressWeightCard.jsx
//
// The Weight card on the Progress tab: the latest weight with how old it is (an old one is called out, so it is not read as today's), the
// Log Weight button at the top of the card where it is easy to reach, how far there is to go to the target, and the chart once there are
// two weigh-ins. With one weigh-in it is a short card, not a tall empty chart. It only draws; the numbers and words come from
// lib/progressInsights.js and the screen handles the two prompts (log a weight, set a target).
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  WEIGHT_RANGES, changeFromStart, changeWords, defaultRange, recentChange, weightChartModel, weightEntries, weightFreshness, weightGoalLine, weightProgress,
} from '../lib/progressInsights';
import ProgressWeightChart from './ProgressWeightChart';
import { GOOD, INK, MID, QUIET, WORSE, p } from './progressStyles';

/**
 * @param {object} props
 * @param {Array} props.logs        the weight log: { id, weightKg, createdAtLocal }, oldest first
 * @param {number|null} props.targetKg
 * @param {Date} [props.now]
 * @param {()=>void} props.onLog        the person tapped Log Weight
 * @param {()=>void} props.onSetTarget  the person tapped the target (to set or change it)
 */
export default function ProgressWeightCard({ logs, targetKg, now = new Date(), onLog, onSetTarget }) {
  const [picked, setPicked] = useState(null); // null until the person picks a range: the card then chooses one from what there is
  const [width, setWidth] = useState(280);
  const entries = useMemo(() => weightEntries(logs), [logs]);
  const latest = entries.length ? entries[entries.length - 1] : null;
  const freshness = weightFreshness(entries, now);
  const progress = weightProgress(entries, targetKg);
  const range = picked || defaultRange(entries, now);
  const model = useMemo(
    () => weightChartModel({ entries, rangeKey: range, now, targetLbs: progress ? progress.targetLbs : null }),
    [entries, range, now, progress],
  );
  const fromStart = changeFromStart(entries);
  const recent = recentChange(entries, now);
  // A move towards the target is green and a move away from it is orange; with no target to judge by it is green, as it always was here.
  const towards = fromStart === null || fromStart === 0 ? null
    : !progress || progress.direction === 'hold' ? fromStart < 0
      : progress.direction === 'lose' ? fromStart < 0 : fromStart > 0;

  return (
    <View testID="progress-weight">
      <View style={p.sectionRow}><Text style={p.sectionTitle}>Weight</Text></View>
      <View style={p.card}>
        <View style={s.head}>
          <View style={s.headText}>
            {latest ? (
              <>
                <Text testID="weight-current" style={s.big}>{`${latest.lbs} lbs`}</Text>
                <Text testID="weight-freshness" style={s.fresh}>{freshness.label}</Text>
              </>
            ) : (
              <Text testID="weight-none" style={s.none}>No weight logged yet.</Text>
            )}
          </View>
          <Pressable testID="weight-log" accessibilityRole="button" accessibilityLabel="Log Weight" style={s.logBtn} onPress={onLog}>
            <Ionicons name="add" size={16} color="#FFF" />
            <Text style={s.logBtnText}>Log Weight</Text>
          </Pressable>
        </View>

        {freshness && freshness.stale ? (
          <Pressable testID="weight-nudge" accessibilityRole="button" accessibilityLabel="Log today's weight" style={s.nudge} onPress={onLog}>
            <Ionicons name="time-outline" size={16} color={WORSE} />
            <Text style={s.nudgeText}>This weigh-in is out of date. Log today&apos;s weight to keep your progress current.</Text>
          </Pressable>
        ) : null}

        {fromStart !== null ? (
          <Text testID="weight-change" style={[s.change, towards === false && { color: WORSE }]}>
            {fromStart === 0 ? 'No change from start' : `${fromStart < 0 ? '↓' : '↑'} ${Math.abs(fromStart)} lbs from start`}
          </Text>
        ) : null}
        {recent ? <Text testID="weight-recent" style={s.recent}>{`${changeWords(recent.lbs)} in the past ${recent.days} days`}</Text> : null}

        {progress ? (
          <View testID="weight-target" style={s.target}>
            <View style={s.targetRow}>
              <Pressable testID="weight-target-edit" accessibilityRole="button" accessibilityLabel="Change target weight" onPress={onSetTarget} hitSlop={8}>
                <Text style={s.targetText}>{`Target: ${progress.targetLbs} lbs`}</Text>
              </Pressable>
              <Text testID="weight-togo" style={[s.toGo, progress.reached && { color: GOOD }]}>{weightGoalLine(progress)}</Text>
            </View>
            <View style={p.barBg}>
              <View testID="weight-progress-fill" style={[p.barFill, { width: `${Math.round(progress.progress * 100)}%` }, progress.reached && { backgroundColor: GOOD }]} />
            </View>
          </View>
        ) : latest ? (
          <Pressable testID="weight-set-target" accessibilityRole="button" accessibilityLabel="Set a target weight" style={s.setTarget} onPress={onSetTarget}>
            <Text style={s.setTargetText}>Set a target weight</Text>
          </Pressable>
        ) : null}

        {entries.length >= 2 ? (
          <View style={s.chartBlock}>
            <View style={[p.chipRow, s.ranges]}>
              {WEIGHT_RANGES.map((r) => {
                const on = r.key === range;
                return (
                  <Pressable
                    key={r.key}
                    testID={`weight-range-${r.key}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${r.label === 'All' ? 'all weigh-ins' : r.label}`}
                    accessibilityState={{ selected: on }}
                    style={[p.chip, on && p.chipOn]}
                    onPress={() => setPicked(r.key)}
                  >
                    <Text style={[p.chipText, on && p.chipTextOn]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View onLayout={(e) => setWidth(Math.max(200, Math.round(e.nativeEvent.layout.width)))}>
              {model ? (
                <ProgressWeightChart model={model} width={width} now={now} />
              ) : (
                <Text testID="weight-range-empty" style={s.rangeEmpty}>Not enough weigh-ins in this range. Try a longer one.</Text>
              )}
            </View>
            {model ? <Text style={s.legend}>Dots are your weigh-ins. The line is the 7-day trend.</Text> : null}
          </View>
        ) : latest ? (
          <Text testID="weight-first" style={s.first}>Log one more weigh-in and your trend chart appears here.</Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headText: { flex: 1 },
  big: { fontSize: 36, fontWeight: '800', color: INK },
  fresh: { fontSize: 12, color: MID, marginTop: 2 },
  none: { fontSize: 14, color: QUIET, paddingTop: 8 },
  logBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: INK, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  logBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.12)' },
  nudgeText: { flex: 1, fontSize: 12, color: INK },
  change: { fontSize: 14, fontWeight: '600', color: GOOD, marginTop: 10 },
  recent: { fontSize: 12, color: MID, marginTop: 2 },
  target: { marginTop: 14 },
  targetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  targetText: { fontSize: 13, color: MID },
  toGo: { fontSize: 13, fontWeight: '700', color: INK },
  setTarget: { alignSelf: 'flex-start', marginTop: 12 },
  setTargetText: { fontSize: 13, fontWeight: '600', color: MID, textDecorationLine: 'underline' },
  chartBlock: { marginTop: 16 },
  ranges: { marginBottom: 10 },
  rangeEmpty: { fontSize: 12, color: QUIET, paddingVertical: 24, textAlign: 'center' },
  legend: { fontSize: 11, color: QUIET, marginTop: 6 },
  first: { fontSize: 12, color: QUIET, marginTop: 14 },
});
