// components/ProgressScansCard.jsx
//
// The Body Scans card on the Progress tab. It used to be two cards (the latest scan with a history list, then a viewer further down); it is
// one now: the latest scan's body fat, lean mass and BMI with what changed since the scan before, a way in to the full scan, the New Scan
// button, and under them the scan viewer (the 3D model, any past scan, or two side by side), which takes over the old history list and the
// Compare Scans button. The numbers come from lib/progressInsights.js scanChanges.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScanComparisonSection from '@/components/ScanComparisonSection';
import { scanChanges } from '../lib/progressInsights';
import { GOOD, INK, MID, QUIET, SCAN_GREEN, WORSE, p } from './progressStyles';

const dateText = (scan) => (scan && scan.createdAtLocal ? new Date(scan.createdAtLocal).toLocaleDateString() : '');
const TONE_COLOR = { good: GOOD, worse: WORSE, same: QUIET };

/** @param {object} props  `scans`: the person's scans, oldest first (store/bodyCompositionStore.js). */
export default function ProgressScansCard({ scans }) {
  const list = Array.isArray(scans) ? scans : [];
  const latest = list.length ? list[list.length - 1] : null;
  const previous = list.length > 1 ? list[list.length - 2] : null;
  const rows = latest ? scanChanges(latest, previous) : [];

  return (
    <View testID="progress-scans">
      <View style={p.sectionRow}><Text style={p.sectionTitle}>Body Scans</Text></View>
      <View style={p.card}>
        {latest ? (
          <>
            <View style={s.head}>
              <View style={s.headTitle}>
                <Ionicons name="body-outline" size={20} color={SCAN_GREEN} />
                <Text style={s.title}>Latest Scan</Text>
              </View>
              <Text testID="scan-date" style={p.quiet}>{dateText(latest) || 'No date'}</Text>
            </View>

            <Pressable
              testID="scan-open"
              accessibilityRole="button"
              accessibilityLabel="View full scan"
              style={s.statsPress}
              onPress={() => router.push(`/body-scan/${latest.id}`)}
            >
              <View style={s.stats}>
                {rows.map((row, i) => (
                  <React.Fragment key={row.key}>
                    {i > 0 ? <View style={s.divider} /> : null}
                    <View style={s.stat}>
                      <Text testID={`scan-${row.key}`} style={[s.value, row.key === 'bodyFat' && { color: SCAN_GREEN }]}>{row.value}</Text>
                      <Text style={s.label}>{row.label}</Text>
                      <Text testID={`scan-${row.key}-change`} style={[s.change, { color: TONE_COLOR[row.tone] || QUIET }]}>{row.text || ' '}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
              <View style={s.openRow}>
                <Text testID="scan-caption" style={s.caption}>
                  {previous ? `Change since your scan on ${dateText(previous) || 'the one before'}` : 'Your first scan. Scan again to see what changed.'}
                </Text>
                <View style={s.openLink}>
                  <Text style={s.openText}>View full scan</Text>
                  <Ionicons name="chevron-forward" size={14} color={MID} />
                </View>
              </View>
            </Pressable>
          </>
        ) : (
          <View testID="scan-empty" style={s.empty}>
            <Ionicons name="body-outline" size={28} color={SCAN_GREEN} />
            <Text style={s.emptyTitle}>No scan yet</Text>
            <Text style={s.emptyText}>Scan your body to track body fat, lean mass and BMI over time.</Text>
          </View>
        )}

        <Pressable testID="scan-new" accessibilityRole="button" accessibilityLabel="New Scan" style={s.newBtn} onPress={() => router.push('/body-scan/capture')}>
          <Text style={s.newBtnText}>New Scan</Text>
        </Pressable>

        {latest ? <ScanComparisonSection scans={list} embedded /> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: INK },
  statsPress: { marginBottom: 14 },
  stats: { flexDirection: 'row', alignItems: 'flex-start' },
  stat: { flex: 1, alignItems: 'center' },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: '#E0E0E0' },
  value: { fontSize: 22, fontWeight: '700', color: INK },
  label: { fontSize: 12, color: MID, marginTop: 2 },
  change: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  openRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 },
  caption: { flex: 1, fontSize: 11, color: QUIET },
  openLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openText: { fontSize: 12, fontWeight: '600', color: MID },
  empty: { alignItems: 'center', paddingVertical: 8, marginBottom: 14, gap: 4 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: INK, marginTop: 4 },
  emptyText: { fontSize: 12, color: QUIET, textAlign: 'center' },
  newBtn: { backgroundColor: SCAN_GREEN, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  newBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});
