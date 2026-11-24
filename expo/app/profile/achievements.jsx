import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Award, Flame, Zap, Medal, Target, Trophy, Crown, Star, Dumbbell, ChevronLeft } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useAchievementStore } from '@/store/achievementStore';
import { useBadgeStore } from '@/store/badgeStore';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import BadgeMedal from '@/components/BadgeMedal';
import { achievementHref, formatEarnedDate } from '@/lib/achievementDetail';

// There are 300 achievements, so the list grows a page at a time.
const ROWS_FIRST = 30;
const ROWS_PAGE = 30;

const BADGE_ICONS = [Flame, Zap, Medal, Target, Trophy, Crown, Star, Dumbbell, Award];

// The floating bottom navigation sits about 100 points above the bottom edge (28 up, 60 tall) and its Home button rises another 20, so the
// last row and "Show more" need that much room under them to be tapped, not just seen.
const NAV_ROOM = 120;

function ProgressRing({ percent = 0, size = 160, stroke = 6 }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const degrees = (clamped / 100) * 360;
  const isOver180 = degrees > 180;
  const rotateFirst = Math.min(degrees, 180);
  const rotateSecond = isOver180 ? degrees - 180 : 0;
  return (
    <View style={[ringStyles.wrap, { width: size, height: size }]}>
      <View style={[ringStyles.track, { width: size, height: size, borderRadius: size / 2, borderWidth: stroke }]} />
      <View
        style={[
          ringStyles.half,
          { width: size, height: size, borderRadius: size / 2, borderWidth: stroke, transform: [{ rotate: `${rotateFirst}deg` }] },
        ]}
      />
      {isOver180 && (
        <View
          style={[
            ringStyles.half,
            { width: size, height: size, borderRadius: size / 2, borderWidth: stroke, transform: [{ rotate: `${180 + rotateSecond}deg` }] },
          ]}
        />
      )}
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute', borderColor: colors.progressTrack },
  half: {
    position: 'absolute',
    borderColor: 'transparent',
    borderTopColor: colors.progressFill,
    borderRightColor: colors.progressFill,
  },
});

export default function AchievementsScreen() {
  const { achievements, initializeAchievements, getUnlockedAchievements, getLockedAchievements, loadAchievements } = useAchievementStore();
  const { badges, loadBadges } = useBadgeStore();
  const { loadXP, getLevel, getExpForLevel, getTotalExp } = useExpStore();
  const user = useUserStore((s) => s.user);
  const [rowsShown, setRowsShown] = useState(ROWS_FIRST);
  // The badge from the BADGES grid whose card is open (an index into `badges`), or null.
  const [openBadge, setOpenBadge] = useState(null);

  useEffect(() => {
    if (!achievements || achievements.length === 0) initializeAchievements();
  }, [achievements, initializeAchievements]);

  useEffect(() => {
    if (user?.uid) {
      loadXP(user.uid);
      loadAchievements(user.uid);
      loadBadges(user.uid);
    }
  }, [user?.uid]);

  const unlocked = getUnlockedAchievements();
  const locked = getLockedAchievements();
  const picked = openBadge === null ? null : (badges || [])[openBadge] || null;
  const PickedIcon = picked ? BADGE_ICONS[openBadge % BADGE_ICONS.length] : null;
  const pickedDate = picked && picked.isUnlocked ? formatEarnedDate(picked.unlockedAt) : null;
  const rows = [...unlocked.map((a) => [a, true]), ...locked.map((a) => [a, false])];

  // XP and level are read the way the Profile screen reads them (store/expStore.js), so the two always agree.
  const totalXp = Math.round(getTotalExp() || 0);
  const level = getLevel();
  const levelStart = getExpForLevel(level);
  const levelSize = Math.max(1, getExpForLevel(level + 1) - levelStart);
  const levelProgress = Math.min(100, Math.max(0, ((getTotalExp() || 0) - levelStart) / levelSize * 100));

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
            <ChevronLeft size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.pageTitle}>ACHIEVEMENTS</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            <ProgressRing percent={levelProgress} size={160} stroke={4} />
            <View style={styles.avatarInner}>
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{(user?.name || 'Z').charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.xpValue}>{totalXp.toLocaleString()} XP</Text>
          <Text style={styles.subtitle}>Level {level}</Text>
        </View>

        <Text style={styles.sectionLabel}>BADGES</Text>
        <View style={styles.badgeGrid}>
          {(badges || []).map((badge, i) => {
            const Icon = BADGE_ICONS[i % BADGE_ICONS.length];
            const isUnlocked = !!badge.isUnlocked;
            return (
              <Pressable
                key={badge.id}
                style={styles.badgeCell}
                testID={`badge-cell-${badge.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${badge.name}, ${isUnlocked ? 'unlocked' : 'locked'}`}
                onPress={() => setOpenBadge(i)}
              >
                <View style={[styles.badgeCircle, !isUnlocked && styles.badgeLocked]}>
                  <Icon size={28} color={isUnlocked ? colors.text : colors.textMuted} />
                </View>
                <Text style={[styles.badgeLabel, !isUnlocked && { color: colors.textMuted }]} numberOfLines={2}>
                  {badge.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>{`${unlocked.length} OF ${achievements.length} UNLOCKED`}</Text>
        {rows.slice(0, rowsShown).map(([a, isUnlocked]) => {
          return (
            <Pressable
              key={a.id}
              style={[styles.achievementRow, !isUnlocked && styles.achievementLocked]}
              testID={`achievement-row-${a.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${a.name}, ${isUnlocked ? 'unlocked' : 'locked'}`}
              onPress={() => router.push(achievementHref(a, null))}
            >
              <View style={styles.achievementIcon}>
                <BadgeMedal frame={a.badge?.frame} metal={a.badge?.metal} icon={a.badge?.icon} size={48} dim={!isUnlocked} />
              </View>
              <View style={styles.achievementText}>
                <Text style={styles.achievementName}>{a.name}</Text>
                <Text style={styles.achievementDesc}>{a.description}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{isUnlocked ? 'Unlocked' : 'Locked'}</Text>
              </View>
            </Pressable>
          );
        })}
        {rowsShown < rows.length && (
          <Pressable style={styles.moreBtn} testID="achievements-show-more" onPress={() => setRowsShown((n) => n + ROWS_PAGE)} accessibilityRole="button">
            <Text style={styles.moreText}>{`Show more (${rows.length - rowsShown} left)`}</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={!!picked} animationType="fade" transparent onRequestClose={() => setOpenBadge(null)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setOpenBadge(null)} testID="badge-card-backdrop">
          {picked ? (
            // A press on the card itself is not a press on the backdrop behind it.
            <Pressable style={styles.sheetCard} testID="badge-card" onPress={() => {}}>
              <View style={[styles.badgeCircle, !picked.isUnlocked && styles.badgeLocked]}>
                {PickedIcon ? <PickedIcon size={28} color={picked.isUnlocked ? colors.text : colors.textMuted} /> : null}
              </View>
              <Text style={styles.sheetName}>{picked.name}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{picked.isUnlocked ? (pickedDate ? `Unlocked ${pickedDate}` : 'Unlocked') : 'Locked'}</Text>
              </View>
              <Text style={styles.sheetLabel}>{picked.isUnlocked ? 'HOW YOU EARNED IT' : 'HOW TO UNLOCK'}</Text>
              <Text style={styles.sheetDesc}>{picked.description}</Text>
              <Pressable style={styles.sheetClose} onPress={() => setOpenBadge(null)} accessibilityRole="button" testID="badge-card-close">
                <Text style={styles.sheetCloseText}>Close</Text>
              </Pressable>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: NAV_ROOM },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 32, alignItems: 'flex-start' },
  pageTitle: { ...typography.h1, textAlign: 'center' },
  avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
  avatarWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  avatarInner: {
    width: 132,
    height: 132,
    borderRadius: 66,
    overflow: 'hidden',
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  avatarInitial: { fontSize: 48, fontWeight: '900', color: colors.text },
  xpValue: { ...typography.h2, marginTop: spacing.md },
  subtitle: { ...typography.caption, marginTop: spacing.xs },
  sectionLabel: { ...typography.label, marginBottom: spacing.md, marginTop: spacing.md },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: spacing.lg },
  badgeCell: { width: '31%', alignItems: 'center', marginBottom: spacing.lg },
  badgeCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  badgeLocked: { opacity: 0.4 },
  badgeLabel: { ...typography.caption, color: colors.text, fontWeight: '600' },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  statusText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  achievementLocked: { opacity: 0.55 },
  achievementIcon: { marginRight: spacing.md },
  moreBtn: { alignItems: 'center', paddingVertical: spacing.md },
  moreText: { ...typography.body, fontWeight: '700' },
  achievementText: { flex: 1, marginRight: spacing.sm },
  achievementName: { ...typography.body, fontWeight: '700' },
  achievementDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sheetCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  sheetName: { ...typography.h2, textAlign: 'center', marginBottom: spacing.sm },
  sheetLabel: { ...typography.label, marginTop: spacing.lg, marginBottom: spacing.xs },
  sheetDesc: { ...typography.body, textAlign: 'center', color: colors.textSecondary },
  sheetClose: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.text,
  },
  sheetCloseText: { ...typography.body, fontWeight: '700', color: colors.bg },
});
