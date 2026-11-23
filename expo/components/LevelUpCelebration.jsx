// The level-up celebration: a full-screen pop-up for the moment XP from a run, a workout, a meal and so on takes the person into a new
// level (lib/levelUp.js has the words and the numbers; components/LevelUpHost.jsx decides when it is up).
//
// It plays in three beats. The badge's ring fills as the old level is finished; the number turns over to the new level with a buzz and a
// burst of confetti, and the ring settles back to how far through the new level the person already is; then what the level gives
// (the XP multiplier, the XP still to go) slides in and the "Keep going" button comes on. The button is the only way out, and it
// stays off until the last beat, so a tap meant for the screen underneath cannot close it by accident.
//
// For someone who has turned on Reduce Motion it appears finished, with no movement and no confetti. It covers the whole screen and takes
// the touches while it is up, so nothing underneath can be tapped by accident.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import PrimaryButton from '@/components/PrimaryButton';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import {
  arcKeyframes, confettiPieces, formatXp, levelUpFacts, levelUpHeadline, sourceLabel,
} from '@/lib/levelUp';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 176;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const FILL_MS = 900; // the ring filling as the old level is finished
const SETTLE_MS = 600; // the ring falling back to the progress through the new level
const FAILSAFE_MS = 4000; // the button comes on by this time even if an animation was held up (the app was in the background, say)

// White shows on the dark backdrop; the rest are the app's accent colours.
const CONFETTI_COLORS = ['#FFFFFF', colors.orange, colors.green, colors.blue, colors.purple];
const CONFETTI_ORIGIN_Y = 0.37; // the badge's centre, as a fraction of the screen's height

function buzz() {
  try {
    const result = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (result && typeof result.catch === 'function') result.catch(() => undefined);
  } catch (e) {
    // A phone with no haptics simply gets none.
  }
}

// One burst of confetti: every piece is one animated number from 0 to 1, drawn along its arc (lib/levelUp.js arcKeyframes).
function Confetti({ width, height }) {
  const pieces = useMemo(() => confettiPieces(), []);
  const progress = useRef(pieces.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const runs = pieces.map((piece, i) => Animated.timing(progress[i], {
      toValue: 1,
      duration: piece.durationMs,
      delay: piece.delayMs,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    const all = Animated.parallel(runs);
    all.start();
    return () => all.stop();
  }, [pieces, progress]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="level-up-confetti">
      {pieces.map((piece, i) => {
        const { input, x, y } = arcKeyframes(piece);
        const p = progress[i];
        const long = piece.shape === 2;
        return (
          <Animated.View
            key={piece.id}
            style={{
              position: 'absolute',
              left: width / 2 - piece.size / 2,
              top: height * CONFETTI_ORIGIN_Y,
              width: piece.size,
              height: long ? piece.size * 2.4 : piece.size,
              borderRadius: piece.shape === 1 ? piece.size / 2 : 2,
              backgroundColor: CONFETTI_COLORS[piece.colorIndex % CONFETTI_COLORS.length],
              opacity: p.interpolate({ inputRange: [0, 0.05, 0.8, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: p.interpolate({ inputRange: input, outputRange: x.map((f) => f * width) }) },
                { translateY: p.interpolate({ inputRange: input, outputRange: y.map((f) => f * height) }) },
                { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.turns * 360}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** info is { from, to, kind, totalXp } (store/levelUpStore.js); onClose is called when the person taps "Keep going". */
export default function LevelUpCelebration({ info, onClose }) {
  const { width, height } = useWindowDimensions();
  const facts = levelUpFacts(info.to, info.totalXp);
  const headline = levelUpHeadline(info.from, info.to);
  const source = sourceLabel(info.kind);

  // null until the phone has said whether Reduce Motion is on.
  const [reduceMotion, setReduceMotion] = useState(null);
  const [closed, setClosed] = useState(false); // the old level is finished: the number shows the new level
  const [burst, setBurst] = useState(false);
  const [ready, setReady] = useState(false); // the button is on

  const scrim = useRef(new Animated.Value(0)).current;
  const cardIn = useRef(new Animated.Value(0)).current;
  const ringFill = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  // The newest progress, read when the ring settles (a second award can change it while the pop-up is up).
  const progressRef = useRef(facts.progress);
  progressRef.current = facts.progress;

  useEffect(() => {
    let alive = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled ? AccessibilityInfo.isReduceMotionEnabled() : false)
      .then((on) => { if (alive) setReduceMotion(Boolean(on)); })
      .catch(() => { if (alive) setReduceMotion(false); });
    return () => { alive = false; };
  }, []);

  // Said aloud when the pop-up comes up (and again if a second award moves the level on while it is up).
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`Level up. ${headline}.`);
  }, [headline]);

  // The phone's back button is "Keep going" too, but only once the button is on.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (ready) onClose();
      return true;
    });
    return () => sub.remove();
  }, [ready, onClose]);

  useEffect(() => {
    if (reduceMotion === null) return undefined;
    if (reduceMotion) {
      scrim.setValue(1);
      cardIn.setValue(1);
      ringFill.setValue(progressRef.current);
      reveal.setValue(1);
      setClosed(true);
      setReady(true);
      buzz();
      return undefined;
    }

    let cancelled = false;
    let second = null;
    const failsafe = setTimeout(() => { if (!cancelled) { setClosed(true); setReady(true); } }, FAILSAFE_MS);
    const first = Animated.sequence([
      Animated.parallel([
        Animated.timing(scrim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(cardIn, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }),
      ]),
      Animated.timing(ringFill, { toValue: 1, duration: FILL_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
    ]);
    first.start(({ finished }) => {
      if (!finished || cancelled) return;
      setClosed(true);
      setBurst(true);
      buzz();
      pop.setValue(0.6);
      second = Animated.parallel([
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.timing(ringFill, { toValue: progressRef.current, duration: SETTLE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.sequence([Animated.delay(150), Animated.timing(reveal, { toValue: 1, duration: 350, useNativeDriver: true })]),
      ]);
      second.start(({ finished: done }) => { if (done && !cancelled) setReady(true); });
    });
    return () => {
      cancelled = true;
      clearTimeout(failsafe);
      first.stop();
      if (second) second.stop();
    };
  }, [reduceMotion, scrim, cardIn, ringFill, pop, reveal]);

  // If the failsafe had to bring the button on, the details must be showing too.
  useEffect(() => { if (ready) reveal.setValue(1); }, [ready, reveal]);

  const dashOffset = ringFill.interpolate({ inputRange: [0, 1], outputRange: [RING_LENGTH, 0] });
  const shownLevel = closed ? facts.level : Math.max(1, info.from);
  const cardWidth = Math.min(width - spacing.xxl * 2, 360);

  return (
    <View
      style={styles.root}
      testID="level-up"
      accessibilityViewIsModal
      importantForAccessibility="yes"
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: scrim }]} />

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            { width: cardWidth, opacity: cardIn, transform: [{ scale: cardIn.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
          ]}
        >
          <View style={styles.pill} accessible accessibilityRole="header">
            <Text style={styles.pillText}>LEVEL UP</Text>
          </View>

          <View style={styles.badge} accessible accessibilityLabel={`Level ${shownLevel}`}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={colors.progressTrack}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={colors.progressFill}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${RING_LENGTH} ${RING_LENGTH}`}
                strokeDashoffset={dashOffset}
                rotation={-90}
                origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
              />
            </Svg>
            <Animated.View style={[styles.badgeCenter, { transform: [{ scale: pop }] }]} pointerEvents="none">
              <Text style={styles.badgeCaption}>LEVEL</Text>
              <Text style={styles.badgeNumber} testID="level-up-number">{shownLevel}</Text>
            </Animated.View>
          </View>

          <Animated.View
            style={[styles.details, { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}
          >
            <Text style={styles.headline}>{headline}</Text>
            {source ? <Text style={styles.source}>{source}</Text> : null}
            <View style={styles.stats}>
              <Stat label="XP multiplier" value={`×${facts.multiplier.toFixed(2)}`} />
              <Stat
                label={facts.isMax ? 'Highest level' : `To Level ${facts.level + 1}`}
                value={facts.isMax ? 'Max' : `${formatXp(facts.xpToNext)} XP`}
              />
            </View>
          </Animated.View>

          <Animated.View style={[styles.action, { opacity: reveal }]}>
            <PrimaryButton title="Keep going" onPress={onClose} disabled={!ready} />
          </Animated.View>
        </Animated.View>
      </View>

      {burst && reduceMotion === false ? <Confetti width={width} height={height} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 9999, elevation: 9999 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.85)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    ...shadows.modal,
  },
  pill: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.lg,
  },
  pillText: { ...typography.label, color: colors.bg, letterSpacing: 2.5 },
  badge: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  badgeCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  badgeCaption: { ...typography.caption, color: colors.textSecondary, letterSpacing: 2 },
  badgeNumber: { fontSize: 64, lineHeight: 70, fontWeight: '800', letterSpacing: -2, color: colors.text },
  details: { alignItems: 'center', marginTop: spacing.lg, alignSelf: 'stretch' },
  headline: { ...typography.h2, color: colors.text, textAlign: 'center' },
  source: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, alignSelf: 'stretch' },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  statValue: { ...typography.numberSmall, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: spacing.xl },
});
