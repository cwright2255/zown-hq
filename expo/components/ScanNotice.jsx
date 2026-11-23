// The notice shown once, before a person's first body scan: what a scan keeps and where its numbers go (lib/scanNotice.js has the
// words and the rule for when it is shown). Nothing here starts the camera; the scan screen asks for the camera only after the person
// has agreed.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PrimaryButton from '@/components/PrimaryButton';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { SCAN_NOTICE_POINTS } from '@/lib/scanNotice';

export default function ScanNotice({ onAgree, onDecline, onOpenPolicy }) {
  return (
    <View style={styles.root} testID="scan-notice">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">Before your first body scan</Text>
        <Text style={styles.intro}>A scan turns your camera view into body measurements. Here is what happens to them.</Text>

        {SCAN_NOTICE_POINTS.map((point) => (
          <View key={point.title} style={styles.row} accessible accessibilityLabel={`${point.title}. ${point.body}`}>
            <View style={styles.iconWrap}>
              <Ionicons name={point.icon} size={20} color={colors.text} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{point.title}</Text>
              <Text style={styles.rowBody}>{point.body}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.footnote}>A scan is an estimate, not medical advice.</Text>
        <Pressable onPress={onOpenPolicy} accessibilityRole="link" accessibilityLabel="Read the Privacy Policy" hitSlop={8}>
          <Text style={styles.link}>Read the Privacy Policy</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.actions}>
        <PrimaryButton title="I understand, continue" onPress={onAgree} />
        <PrimaryButton title="Not now" variant="outline" onPress={onDecline} style={styles.secondary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.base },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.h4, color: colors.text, marginBottom: 2 },
  rowBody: { ...typography.body, color: colors.textSecondary },
  footnote: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.sm },
  link: { ...typography.bodySmall, color: colors.text, textDecorationLine: 'underline', marginTop: spacing.sm },
  actions: { paddingHorizontal: spacing.base, paddingBottom: spacing.lg, paddingTop: spacing.sm },
  secondary: { marginTop: spacing.sm },
});
