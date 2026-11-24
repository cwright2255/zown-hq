import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PREMIUM_REWARDS, premiumBenefits } from '../lib/premiumRewards';
import { claimedLine, passLine, rewardState } from '../lib/premiumRewardText';

// The Premium side of the Battle Pass: the Premium Pass card (what it gives, or that the person has it) and the twenty rewards, one on every
// fifth tier. It only draws what it is given: the screen reads the premium store and hands over the level, the pass, the claims and what to do
// on a tap, and the server decides every claim (functions/src/premiumPass.js).
const ICONS = {
  aiMessages: 'chatbubbles-outline',
  scanCredit: 'body-outline',
  legendTrial: 'diamond-outline',
  discount: 'pricetag-outline',
  shipping: 'cube-outline',
  colorway: 'color-palette-outline',
  shirt: 'shirt-outline',
};

function RewardRow({ reward, state, claim, busy, onClaim }) {
  const claimed = state === 'claimed';
  const ready = state === 'ready';
  return (
    <View testID={`premium-reward-${reward.tier}`} style={[s.row, reward.big && s.rowBig, claimed && s.rowClaimed]}>
      <View style={[s.iconWrap, claimed && s.iconWrapClaimed]}>
        <Ionicons name={ICONS[reward.kind]} size={22} color={claimed ? '#FFD700' : '#000'} />
      </View>
      <View style={s.info}>
        <Text style={s.tier}>Level {reward.tier}</Text>
        <Text style={s.name}>{reward.name}</Text>
        <Text style={s.blurb}>{claimed ? claimedLine(claim) || reward.blurb : reward.blurb}</Text>
      </View>
      <View style={s.side}>
        {claimed && (
          <View style={s.sideClaimed}>
            <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
            <Text style={s.claimedText}>CLAIMED</Text>
          </View>
        )}
        {ready && (
          <Pressable
            testID={`premium-claim-${reward.tier}`}
            accessibilityRole="button"
            accessibilityLabel={`Claim ${reward.name}`}
            style={[s.claimBtn, busy && s.claimBtnBusy]}
            onPress={() => onClaim(reward.tier)}
            disabled={busy}
          >
            <Text style={s.claimBtnText}>CLAIM</Text>
          </Pressable>
        )}
        {(state === 'locked' || state === 'needs-pass') && (
          <View style={s.sideLocked}>
            <Ionicons name="lock-closed" size={14} color="#999" />
            <Text style={s.lockedText}>{state === 'locked' ? `Level ${reward.tier}` : 'Pass'}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * @param {object} props
 * @param {number} props.level          the person's level
 * @param {boolean} props.hasPass       whether they have the Premium Pass right now
 * @param {object|null} props.pass      the pass document (for its end date)
 * @param {object} props.claims         what they have claimed, by tier number as text
 * @param {number|null} props.claiming  the tier whose claim is on its way
 * @param {(tier:number)=>void} props.onClaim
 * @param {()=>void} props.onOpenRewards  opens My Rewards
 * @param {()=>void} props.onGetPass      the person asked to get the Premium Pass
 */
export default function PremiumRewards({ level, hasPass, pass, claims, claiming, onClaim, onOpenRewards, onGetPass }) {
  const active = passLine(pass, hasPass);
  return (
    <View testID="premium-rewards">
      <View style={s.card}>
        <Text style={s.cardTitle}>Premium Pass</Text>
        {active ? (
          <View style={s.activeRow}>
            <Ionicons name="checkmark-circle" size={16} color="#FFD700" />
            <Text testID="premium-pass-line" style={s.activeText}>{active}</Text>
          </View>
        ) : (
          <Text style={s.cardPrice}>$9.99 / season</Text>
        )}
        {premiumBenefits().map((b) => (
          <View key={b} style={s.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color="#FFD700" />
            <Text style={s.benefitText}>{b}</Text>
          </View>
        ))}
        {active ? (
          <Pressable testID="open-my-rewards" accessibilityRole="button" accessibilityLabel="My Rewards" style={s.cardBtn} onPress={onOpenRewards}>
            <Ionicons name="gift-outline" size={18} color="#000" />
            <Text style={s.cardBtnText}>My Rewards</Text>
            <Ionicons name="chevron-forward" size={18} color="#000" />
          </Pressable>
        ) : (
          <Pressable testID="get-premium-pass" accessibilityRole="button" accessibilityLabel="Get the Premium Pass" style={s.cardBtn} onPress={onGetPass}>
            <Text style={s.cardBtnText}>Get the Premium Pass</Text>
          </Pressable>
        )}
      </View>

      {PREMIUM_REWARDS.map((reward) => {
        const claim = claims[String(reward.tier)];
        return (
          <RewardRow
            key={reward.tier}
            reward={reward}
            claim={claim}
            state={rewardState({ reward, claim, level, hasPass })}
            busy={claiming === reward.tier}
            onClaim={onClaim}
          />
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#000', borderRadius: 16, padding: 20, marginHorizontal: 20, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  cardPrice: { fontSize: 14, color: '#999', marginTop: 2, marginBottom: 12 },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 12 },
  activeText: { fontSize: 14, fontWeight: '700', color: '#FFD700' },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  benefitText: { fontSize: 13, color: '#EEE' },
  cardBtn: { backgroundColor: '#FFD700', height: 48, borderRadius: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 },
  cardBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 16, borderWidth: 1, borderColor: '#E5E5E5', padding: 14, marginHorizontal: 20, marginBottom: 10 },
  rowBig: { borderColor: '#FFD700', borderWidth: 2, backgroundColor: '#FFFBE6' },
  rowClaimed: { backgroundColor: '#FFF' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E5E5E5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  iconWrapClaimed: { backgroundColor: '#000' },
  info: { flex: 1 },
  tier: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 1 },
  name: { fontSize: 15, fontWeight: '800', color: '#000', marginTop: 1 },
  blurb: { fontSize: 12, color: '#666', marginTop: 2 },
  side: { marginLeft: 10, alignItems: 'center', justifyContent: 'center', minWidth: 64 },
  sideClaimed: { alignItems: 'center', gap: 2 },
  claimedText: { fontSize: 10, fontWeight: '800', color: '#22C55E' },
  sideLocked: { alignItems: 'center', gap: 2 },
  lockedText: { fontSize: 11, fontWeight: '700', color: '#999' },
  claimBtn: { backgroundColor: '#000', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  claimBtnBusy: { opacity: 0.5 },
  claimBtnText: { fontSize: 12, fontWeight: '800', color: '#FFD700' },
});
