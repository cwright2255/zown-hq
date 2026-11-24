// components/progressStyles.js
//
// The look the Progress tab's cards share, taken from the cards that were already on it (app/progress.jsx): white, 16px corners, a soft
// shadow, 20px from each edge; black and white with grey for the quiet text; green and orange only for a change for the better or the worse.
import { Platform, StyleSheet } from 'react-native';

const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 3 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

export const INK = '#000000';
export const QUIET = '#999999';
export const MID = '#666666';
export const TRACK = '#E5E5E5';
export const GOOD = '#22C55E';
export const WORSE = '#F97316';
export const SCAN_GREEN = '#4CAF50';

export const p = StyleSheet.create({
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: INK },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 16, ...shadow },
  link: { fontSize: 13, fontWeight: '600', color: MID },
  quiet: { fontSize: 12, color: QUIET },
  barBg: { height: 6, borderRadius: 3, backgroundColor: TRACK, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: INK },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F0F0F0' },
  chipOn: { backgroundColor: INK },
  chipText: { fontSize: 12, fontWeight: '600', color: MID },
  chipTextOn: { color: '#FFF' },
});
