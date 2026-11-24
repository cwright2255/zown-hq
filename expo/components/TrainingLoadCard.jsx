// components/TrainingLoadCard.jsx
//
// The one thing genuinely nobody else can build well: Strava only sees
// runs/rides, AllTrails only sees hikes — Zown has real completed
// workouts, runs, AND hikes in one place. This surfaces that as a real
// acute:chronic training load reading (lib/trainingLoad.js), not a
// vague "how are you feeling" prompt.
//
// Under the bar there is a plain scale (below usual / typical / higher), and before there is a reading it says how many of the days it
// needs have a workout, run or hike so far (`daysLogged` of `daysNeeded`), with a bar, so it is clear what is left to do.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/constants/theme';
import { h } from './healthStyles';

export const ZONE_COLOR = {
  detraining: '#3B82F6',
  sweet_spot: '#22C55E',
  elevated: '#D97706',
  high: '#DC2626',
  insufficient_data: colors.textSecondary,
};

const ZONE_ICON = {
  detraining: 'trending-down-outline',
  sweet_spot: 'checkmark-circle-outline',
  elevated: 'alert-circle-outline',
  high: 'warning-outline',
  insufficient_data: 'time-outline',
};

export default function TrainingLoadCard({ trainingLoad, aiInsight, daysLogged = null, daysNeeded = 5 }) {
  if (!trainingLoad) return null;
  const color = ZONE_COLOR[trainingLoad.zone];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name={ZONE_ICON[trainingLoad.zone]} size={20} color={color} />
        <Text style={styles.title}>Training Load</Text>
      </View>

      {trainingLoad.zone === 'insufficient_data' ? (
        <>
          <Text style={styles.insufficientText}>
            Keep logging workouts, runs, and hikes — this needs about a week of history to give a real reading.
          </Text>
          {typeof daysLogged === 'number' ? (
            <View style={styles.unlock}>
              <Text testID="training-load-days" style={styles.unlockText}>
                {`${Math.min(daysLogged, daysNeeded)} of ${daysNeeded} days with a workout, run or hike so far`}
              </Text>
              <View style={h.barBg}>
                <View testID="training-load-unlock" style={[h.barFill, { width: `${Math.round((Math.min(daysLogged, daysNeeded) / daysNeeded) * 100)}%` }]} />
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.ratioRow}>
            <Text style={[styles.ratioValue, { color }]}>{trainingLoad.ratio.toFixed(2)}</Text>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[styles.zoneLabel, { color }]}>{trainingLoad.zoneLabel}</Text>
              <Text style={styles.subText}>
                {trainingLoad.acuteLoad} kcal this week vs. {trainingLoad.chronicWeeklyAvg} kcal your usual week
              </Text>
            </View>
          </View>

          {/* Simple visual bar: sweet spot band 0.8-1.3, marker at the
              real ratio value. Range shown is 0-2.0+, clamped. */}
          <View style={styles.barTrack}>
            <View style={[styles.sweetSpotBand, { left: '40%', width: '25%' }]} />
            <View style={[styles.marker, { left: `${Math.min(100, (trainingLoad.ratio / 2) * 100)}%`, backgroundColor: color }]} />
          </View>

          {/* The same three stretches as the bar above: under 0.8 of your usual week, 0.8 to 1.3, over 1.3 (the bar runs to 2.0). */}
          <View testID="training-load-scale" style={styles.scale}>
            <Text style={[styles.scaleText, { flex: 40, textAlign: 'left' }]}>Below usual</Text>
            <Text style={[styles.scaleText, { flex: 25, textAlign: 'center' }]}>Typical</Text>
            <Text style={[styles.scaleText, { flex: 35, textAlign: 'right' }]}>Higher</Text>
          </View>

          {aiInsight && <Text style={styles.aiInsightText}>{aiInsight}</Text>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: h.card,
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  title: { ...typography.h4, color: colors.text },
  insufficientText: { ...typography.bodySmall, color: colors.textSecondary },
  ratioRow: { flexDirection: 'row', alignItems: 'center' },
  ratioValue: { fontSize: 32, fontWeight: '800' },
  zoneLabel: { fontSize: 14, fontWeight: '700' },
  subText: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  barTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: spacing.md, position: 'relative' },
  sweetSpotBand: { position: 'absolute', height: 6, backgroundColor: 'rgba(34,197,94,0.3)', borderRadius: 3 },
  marker: { position: 'absolute', top: -3, width: 12, height: 12, borderRadius: 6, marginLeft: -6 },
  scale: { flexDirection: 'row', marginTop: spacing.xs },
  scaleText: { fontSize: 11, color: colors.textSecondary },
  unlock: { marginTop: spacing.md },
  unlockText: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  aiInsightText: { ...typography.bodySmall, color: colors.text, marginTop: spacing.md, fontStyle: 'italic' },
});
