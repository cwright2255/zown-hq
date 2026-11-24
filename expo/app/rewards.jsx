// app/rewards.jsx
//
// My Rewards: what the Premium side of the Battle Pass has given the person that is still to be used: the single-use codes for the shop
// (discounts, free shipping, colorways, the free shirt), the bonus AI messages and the free body scans they have left. Every one of these is
// the server's (functions/src/premiumPass.js); this screen shows what the phone follows from it (store/premiumStore.js).
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import { usePremiumStore } from '@/store/premiumStore';
import { CODE_HELP, walletCodes, walletSummary } from '@/lib/premiumRewardText';

export default function RewardsScreen() {
  const claims = usePremiumStore((st) => st.claims);
  const aiMessages = usePremiumStore((st) => st.aiMessages);
  const scanCredits = usePremiumStore((st) => st.scanCredits);
  const [copied, setCopied] = useState(null);

  const codes = useMemo(() => walletCodes(claims), [claims]);
  const left = walletSummary({ aiMessages, scanCredits });

  const copy = async (code) => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(code);
    } catch (e) {
      console.warn('[Rewards] could not copy the code:', e?.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="My Rewards" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {left.length > 0 && (
          <View style={styles.leftBox} testID="rewards-left">
            {left.map((line) => <Text key={line} style={styles.leftLine}>{line}</Text>)}
          </View>
        )}

        {codes.length > 0 ? (
          <>
            <Text style={styles.label}>Your codes</Text>
            {codes.map((c) => (
              <View key={c.code} style={styles.codeCard} testID={`reward-code-${c.tier}`}>
                <Text style={styles.codeKind}>{c.label}</Text>
                <Text style={styles.codeDetail}>{c.detail}</Text>
                <View style={styles.codeRow}>
                  <Text style={styles.code} selectable>{c.code}</Text>
                  <Pressable
                    testID={`copy-code-${c.tier}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Copy ${c.label}`}
                    style={styles.copyBtn}
                    onPress={() => copy(c.code)}
                  >
                    <Text style={styles.copyText}>{copied === c.code ? 'Copied' : 'Copy'}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Text style={styles.help}>{CODE_HELP}</Text>
          </>
        ) : (
          <View style={styles.empty} testID="rewards-empty">
            <Text style={styles.emptyTitle}>No codes yet</Text>
            <Text style={styles.emptyText}>
              Claim a Premium reward on the Battle Pass and any code that comes with it is kept here.
            </Text>
            <Pressable style={styles.emptyBtn} accessibilityRole="button" accessibilityLabel="Go to the Battle Pass" onPress={() => router.push('/battlepass')}>
              <Text style={styles.emptyBtnText}>Go to the Battle Pass</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  leftBox: { backgroundColor: '#000', borderRadius: 16, padding: 18, marginBottom: 20, gap: 6 },
  leftLine: { fontSize: 15, fontWeight: '700', color: '#FFD700' },
  label: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 },
  codeCard: { backgroundColor: '#F5F5F5', borderRadius: 16, borderWidth: 1, borderColor: '#E5E5E5', padding: 16, marginBottom: 12 },
  codeKind: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 1 },
  codeDetail: { fontSize: 16, fontWeight: '800', color: '#000', marginTop: 2, marginBottom: 10 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: 2 },
  copyBtn: { backgroundColor: '#000', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  copyText: { fontSize: 13, fontWeight: '800', color: '#FFD700' },
  help: { fontSize: 13, color: '#666', marginTop: 4, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#000' },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 6, marginBottom: 18, lineHeight: 20 },
  emptyBtn: { backgroundColor: '#000', paddingHorizontal: 22, height: 46, borderRadius: 23, justifyContent: 'center' },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#FFD700' },
});
