// An achievement's own screen, opened by tapping it on the Battle Pass (app/battlepass.jsx). The badge sits in a black card: dim at first,
// then, if the achievement is earned, it lights up with a buzz, spins in 3D and slows to a stop facing you; a finger dragged across the
// card turns it, and a tap spins it once more. An achievement that is not earned yet stays dim, with a lock on it. Under the card:
// the name, what it is for, when it was earned, the XP it gives, its category and, for one still to earn, how far along you are.
//
// lib/achievementBadge.js has the maths of the turn, components/AchievementBadge.jsx draws the badge, lib/achievementDetail.js writes
// the words. Nothing here changes any achievement or XP: it only shows what the server has unlocked (store/achievementStore.js).
// For someone with Reduce Motion on, the badge is simply lit and facing you; dragging still turns it, with no animation, and
// there are no sparkles, no float and no spin.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import AchievementBadge from '@/components/AchievementBadge';
import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  INTRO, SPARKLES, TURN_SLOP_PX, badgeSize, dragAngle, replayAngle, settleAngle, sparklePath, turnDuration,
} from '@/lib/achievementBadge';
import { achievementFacts, readProgress } from '@/lib/achievementDetail';
import { getMetal } from '@/lib/badgeFrames';
import { useAchievementStore } from '@/store/achievementStore';

const RESTING_GLOW = 0.45; // how strong the gold glow behind a lit badge stays
const FLOAT_MS = 1300; // one way, up or down

function buzz() {
  try {
    const result = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (result && typeof result.catch === 'function') result.catch(() => undefined);
  } catch (e) {
    // A phone with no haptics simply gets none.
  }
}

// One four-point sparkle that twinkles on and off, over and over, once `on`.
function Sparkle({ spec, heroSize, on, color }) {
  const twinkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!on) {
      twinkle.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(spec.delayMs),
      Animated.timing(twinkle, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(twinkle, { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.delay(1400),
    ]));
    loop.start();
    return () => loop.stop();
  }, [on, twinkle, spec.delayMs]);

  return (
    <Animated.View
      pointerEvents="none"
      testID="sparkle"
      style={{
        position: 'absolute',
        left: spec.x * heroSize - spec.size / 2,
        top: spec.y * heroSize - spec.size / 2,
        opacity: twinkle,
        transform: [
          { scale: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
          { rotate: twinkle.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) },
        ],
      }}
    >
      <Svg width={spec.size} height={spec.size}>
        <Path d={sparklePath(spec.size)} fill={color} />
      </Svg>
    </Animated.View>
  );
}

// Where a touch is, from an event: React Native puts the position on the event itself; a browser keeps it in the list of touches.
// null when it has no usable position, so a stray event cannot send the badge's angle to NaN.
function readPoint(e) {
  const n = (e && e.nativeEvent) || {};
  const touch = (n.touches && n.touches[0]) || (n.changedTouches && n.changedTouches[0]) || {};
  const x = Number.isFinite(n.pageX) ? n.pageX : touch.pageX;
  const y = Number.isFinite(n.pageY) ? n.pageY : touch.pageY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y, time: Number.isFinite(n.timestamp) && n.timestamp > 0 ? n.timestamp : Date.now() };
}

function Stat({ value, label }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Header({ title }) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.back} />
    </View>
  );
}

export default function AchievementScreen() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const achievement = useAchievementStore((s) => (s.achievements || []).find((a) => a.id === id));
  const progress = useMemo(() => readProgress(params), [params.current, params.target]); // eslint-disable-line react-hooks/exhaustive-deps
  const facts = useMemo(() => (achievement ? achievementFacts(achievement, progress) : null), [achievement, progress]);
  const earned = Boolean(facts && facts.earned);

  const { width } = useWindowDimensions();
  const heroSize = Math.min(width - spacing.lg * 2, 420);
  const badgeWidth = Math.round(heroSize * 0.5);
  const { height: badgeHeight } = badgeSize(badgeWidth);

  // null until the phone has said whether Reduce Motion is on.
  const [reduceMotion, setReduceMotion] = useState(null);
  const [sparkling, setSparkling] = useState(false);

  const theta = useRef(new Animated.Value(0)).current; // the badge's angle, in degrees
  const lit = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const angle = useRef(0); // the newest angle, as a plain number (kept by the listener below)
  const running = useRef(null); // the animation that is turning the badge now, if any
  const spinning = useRef(false);
  const floating = useRef(false);
  const loops = useRef([]);
  const touch = useRef({ active: false, turning: false, vertical: false, startX: 0, startY: 0, base: 0, lastX: 0, lastT: 0, velocity: 0 });

  useEffect(() => {
    const listener = theta.addListener(({ value }) => { angle.current = value; });
    return () => theta.removeListener(listener);
  }, [theta]);

  useEffect(() => {
    let alive = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled ? AccessibilityInfo.isReduceMotionEnabled() : false)
      .then((on) => { if (alive) setReduceMotion(Boolean(on)); })
      .catch(() => { if (alive) setReduceMotion(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => () => {
    if (running.current) running.current.stop();
    loops.current.forEach((loop) => loop.stop());
  }, []);

  // The badge floats up and down, once it has settled for the first time.
  const startFloat = () => {
    if (floating.current) return;
    floating.current = true;
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: FLOAT_MS, easing: ease, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: FLOAT_MS, easing: ease, useNativeDriver: true }),
    ]));
    loops.current.push(loop);
    loop.start();
  };

  // What happens when the screen opens.
  useEffect(() => {
    if (reduceMotion === null || !facts) return undefined;
    if (!earned) {
      lit.setValue(0);
      glow.setValue(0);
      return undefined;
    }
    if (reduceMotion) {
      lit.setValue(1);
      glow.setValue(RESTING_GLOW);
      buzz();
      return undefined;
    }

    let cancelled = false;
    let lighting = null;
    let spin = null;
    const wait = setTimeout(() => {
      if (cancelled) return;
      buzz();
      setSparkling(true);
      spinning.current = true;
      // The light and the glow are one animation and the turn another, so a finger that takes over the turn leaves the badge lit.
      lighting = Animated.parallel([
        Animated.timing(lit, { toValue: 1, duration: INTRO.litMs, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: INTRO.litMs, useNativeDriver: true }),
          Animated.timing(glow, { toValue: RESTING_GLOW, duration: 900, useNativeDriver: true }),
        ]),
      ]);
      spin = Animated.timing(theta, { toValue: INTRO.turns * 360, duration: INTRO.spinMs, easing: Easing.out(Easing.cubic), useNativeDriver: true });
      running.current = spin;
      lighting.start();
      spin.start(({ finished }) => {
        if (!finished || cancelled) return;
        spinning.current = false;
        startFloat();
      });
    }, INTRO.waitMs);

    return () => {
      cancelled = true;
      clearTimeout(wait);
      if (lighting) lighting.stop();
      if (spin) spin.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, earned, facts && facts.name]);

  // Takes the badge to `target` degrees, easing to a stop (or straight there, for someone with Reduce Motion on).
  const turnTo = (target) => {
    if (running.current) running.current.stop();
    if (reduceMotion) {
      theta.setValue(target);
      spinning.current = false;
      return;
    }
    spinning.current = true;
    const turn = Animated.timing(theta, {
      toValue: target,
      duration: turnDuration(target - angle.current),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    running.current = turn;
    turn.start(({ finished }) => {
      if (!finished) return;
      spinning.current = false;
      if (earned) startFloat();
    });
  };

  // A finger dragged across the card turns the badge; one that goes mostly up or down is the page scrolling, and is left to it.
  const onTouchStart = (e) => {
    const point = readPoint(e);
    if (!point) return;
    touch.current = {
      active: true, turning: false, vertical: false, startX: point.x, startY: point.y, base: 0, lastX: point.x, lastT: point.time, velocity: 0,
    };
  };

  const onTouchMove = (e) => {
    const t = touch.current;
    if (!t.active || t.vertical) return;
    const point = readPoint(e);
    if (!point) return;
    const { x: pageX, y: pageY, time: now } = point;
    if (!t.turning) {
      const dx = Math.abs(pageX - t.startX);
      const dy = Math.abs(pageY - t.startY);
      if (dy > dx && dy > TURN_SLOP_PX) {
        t.vertical = true;
        return;
      }
      if (dx < TURN_SLOP_PX) return;
      // The finger has begun to turn it: take over from whatever it was doing, from the angle it is at.
      if (running.current) running.current.stop();
      spinning.current = false;
      t.turning = true;
      t.base = angle.current;
      t.startX = pageX;
      t.lastX = pageX;
      t.lastT = now;
    }
    const dt = now - t.lastT;
    if (dt > 0) t.velocity = 0.6 * t.velocity + 0.4 * ((pageX - t.lastX) / dt);
    t.lastX = pageX;
    t.lastT = now;
    theta.setValue(dragAngle(t.base, pageX - t.startX));
  };

  const onTouchEnd = (e, cancelled = false) => {
    const t = touch.current;
    if (!t.active) return;
    t.active = false;
    if (t.turning) {
      turnTo(settleAngle(angle.current, t.velocity));
    } else if (!cancelled && !t.vertical && earned && !spinning.current && !reduceMotion) {
      turnTo(replayAngle(angle.current)); // a tap: once more round
    }
  };

  if (!facts) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Achievement" />
        <View style={styles.missing}>
          <Text style={styles.missingText}>This achievement could not be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const glowOpacity = glow;
  const badge = achievement.badge || {};
  const metal = getMetal(badge.metal);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Achievement" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[styles.hero, { width: heroSize, height: heroSize }]}
          testID="achievement-hero"
          accessible
          accessibilityRole="image"
          accessibilityLabel={facts.badgeLabel}
          accessibilityHint={earned ? 'Drag sideways to turn the badge, or tap to spin it.' : 'Drag sideways to turn the badge.'}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={(e) => onTouchEnd(e, false)}
          onTouchCancel={(e) => onTouchEnd(e, true)}
        >
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: glowOpacity }]} pointerEvents="none" testID="achievement-glow">
            <Svg width={heroSize} height={heroSize}>
              <Defs>
                <RadialGradient id="zbGlow" cx="50%" cy="46%" r="52%">
                  <Stop offset="0" stopColor={metal.light} stopOpacity={0.5} />
                  <Stop offset="0.55" stopColor={metal.dark} stopOpacity={0.14} />
                  <Stop offset="1" stopColor="#000000" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width={heroSize} height={heroSize} fill="url(#zbGlow)" />
            </Svg>
          </Animated.View>

          <View style={[styles.badgeSlot, { height: heroSize }]} pointerEvents="none">
            <View style={{ marginTop: -Math.round(badgeHeight * 0.04) }}>
              <AchievementBadge frame={badge.frame} metal={badge.metal} icon={badge.icon} size={badgeWidth} theta={theta} lit={lit} bob={bob} locked={!earned} />
            </View>
          </View>

          {SPARKLES.map((spec, i) => (
            <Sparkle key={i} spec={spec} heroSize={heroSize} on={earned && sparkling && reduceMotion === false} color={metal.shine} />
          ))}
        </View>

        <View style={styles.details}>
          <Text style={styles.title} accessibilityRole="header">{facts.title}</Text>
          {facts.description ? <Text style={styles.description}>{facts.description}</Text> : null}
          <Text style={styles.earned} testID="achievement-earned">{facts.earnedLabel}</Text>

          <View style={styles.stats}>
            <Stat value={facts.rewardValue} label={facts.rewardLabel} />
            <View style={styles.divider} />
            <Stat value={(facts.category || '—').toUpperCase()} label="Category" />
          </View>

          {facts.progress ? (
            <View style={styles.progressCard} testID="achievement-progress">
              <View style={styles.progressTop}>
                <Text style={styles.progressTitle}>Progress</Text>
                <Text style={styles.progressCount}>{`${facts.progress.current.toLocaleString('en-US')} / ${facts.progress.target.toLocaleString('en-US')}`}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.round(facts.progress.fraction * 100)}%` }]} />
              </View>
              <Text style={styles.progressNote}>{`${facts.progress.remaining.toLocaleString('en-US')} to go`}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.base, paddingVertical: spacing.sm },
  back: { width: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { ...typography.h4, color: colors.text },
  content: { alignItems: 'center', paddingBottom: 120 },
  hero: { backgroundColor: '#000000', borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.sm },
  badgeSlot: { alignItems: 'center', justifyContent: 'center' },
  details: { alignSelf: 'stretch', paddingHorizontal: spacing.lg, alignItems: 'center', marginTop: spacing.lg },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '900', letterSpacing: 0.5, color: colors.text, textAlign: 'center' },
  description: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  earned: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm },
  stats: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: spacing.xl,
    paddingVertical: spacing.base, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  statValue: { fontSize: 18, fontWeight: '800', letterSpacing: 0.3, color: colors.text },
  statLabel: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },
  progressCard: { alignSelf: 'stretch', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.base, marginTop: spacing.lg },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
  progressTitle: { ...typography.h4, color: colors.text },
  progressCount: { ...typography.numberSmall, color: colors.text },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.progressTrack, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.progressFill },
  progressNote: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.sm },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  missingText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
