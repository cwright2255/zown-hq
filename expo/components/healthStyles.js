// components/healthStyles.js
//
// The look the Health screen's cards share, the same as the Progress tab's: white, 16px corners, a soft shadow, 20px from each edge;
// black and white with grey for the quiet text; green and orange only for a change for the better or the worse.
import { Platform, StyleSheet } from 'react-native';

/** The soft shadow every card here has (and TrendChart's), in place of an outline. */
export const CARD_SHADOW = Platform.select({
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

/** The colour that says a change is for the better, the worse, or no change. */
export const TONE_COLOR = { good: GOOD, worse: WORSE, same: QUIET };

export const h = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 16, ...CARD_SHADOW },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: INK, paddingHorizontal: 20, marginTop: 8, marginBottom: 10 },
  barBg: { height: 6, borderRadius: 3, backgroundColor: TRACK, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: INK },
});
