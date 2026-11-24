import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, Image, Platform, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import { useBattlePassStore } from '@/store/battlePassStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { useHealthStore } from '@/store/healthStore';
import { useAchievementStore } from '@/store/achievementStore';
import { useLifetimeStore } from '@/store/lifetimeStore';
import { lifetimeOf } from '@/lib/lifetimeTotals';
import { localDateKey } from '@/lib/localDate';
import { sessionsOf, activityStreak } from '@/lib/activity';
import { buildMissions } from '@/lib/battlePassMissions';
import { achievementHref } from '@/lib/achievementDetail';
import { hikeFacts, listOrder, progressFor } from '@/lib/achievementProgress';
import { TIER_REWARDS } from '@/lib/battlePassTiers';
import { usePremiumStore } from '@/store/premiumStore';
import { premiumRewardAt } from '@/lib/premiumRewards';
import { outcomeAlert } from '@/lib/premiumRewardText';
import BadgeMedal from '@/components/BadgeMedal';
import PremiumRewards from '@/components/PremiumRewards';

const SEASON_START = new Date('2026-06-01T00:00:00');
const SEASON_LENGTH_DAYS = 90;

const ACH_W = (Dimensions.get('window').width - 52) / 2;
const ACH_FIRST = 6; // achievements listed before anyone asks for more
const ACH_PAGE = 24; // and how many more each ask lists

// One tier in the row: its number, its badge (full colour once it can be claimed, faded while it is out of reach), its reward and the claim button.
const TIER_W = 110;
const TIER_GAP = 2;
const TIER_STEP = TIER_W + TIER_GAP; // the width of one tier in the row, so the row can jump straight to one

function TierCard({tier, onClaim, busy}){
  const {claimed, current, locked} = tier;
  const bg = claimed ? '#000' : current ? '#FFF' : '#F5F5F5';
  const border = claimed ? '#FFD700' : current ? '#FFD700' : '#E5E5E5';
  return (
    <View style={s.tierCol}>
      <View style={s.tierNum}><Text style={s.tierNumText}>{tier.t}</Text></View>
      <View style={[s.tierBox,{backgroundColor:bg,borderColor:border}]}>
        <BadgeMedal testID={`tier-badge-${tier.t}`} frame={tier.badge.frame} metal={tier.badge.metal} icon={tier.badge.icon} size={60} dim={locked} />
        <Text style={[s.tierName,{color:claimed?'#FFF':current?'#000':'#999'}]} numberOfLines={2}>{tier.name}</Text>
        {claimed && <Text style={s.tierClaimed}>CLAIMED</Text>}
        {current && <Pressable style={[s.claimBtn, busy && {opacity:0.5}]} onPress={onClaim} disabled={busy}><Text style={s.claimBtnText}>CLAIM</Text></Pressable>}
        {locked && <Text style={s.tierXpNeed}>{tier.xpNeeded} XP</Text>}
      </View>
    </View>
  );
}

function MissionRow({m}){
  const pct = Math.min(100,Math.round(m.current/m.target*100));
  return (
    <View style={s.missionCard}>
      <View style={s.missionInfo}>
        <Text style={s.missionTitle}>{m.title}</Text>
        <View style={s.missionBarBg}><View style={[s.missionBarFill,{width:pct+'%'}]} /></View>
        <Text style={s.missionProg}>{m.current}{m.unit||''}/{m.target}{m.unit||''}</Text>
      </View>
      <View style={s.missionXpBadge}><Text style={s.missionXpText}>+{m.xp}</Text></View>
    </View>
  );
}


export default function BattlePassScreen(){
  const { user } = useUserStore();
  const uid = user?.uid;
  const { getLevel, getExpForLevel, getExpToNextLevel, getTotalExp, loadXP } = useExpStore();
  // Real fix: same bug as app/profile.jsx - totalExp destructured
  // directly from useExpStore() was always undefined, since that
  // top-level property never existed on the store.
  const totalExp = getTotalExp ? getTotalExp() : 0;
  const { claimedTiers, claimTier, claiming, loadBattlePass } = useBattlePassStore();
  // The Premium side: the Premium Pass, what has been claimed on it and the claim itself, all kept on the server (store/premiumStore.js).
  const premium = usePremiumStore();
  const hasPass = premium.hasPass();
  const { completedWorkouts, loadWorkouts } = useWorkoutStore();
  const serverTotals = useLifetimeStore((st) => st.totals);
  const { runs, loadRuns } = useRunningStore();
  const { completedHikes, loadCompletedHikes } = useHikingStore();
  const { getMealsByDate, loadNutritionData, meals } = useNutritionStore();
  const { steps, stepsDate, loadAllHealth } = useHealthStore();
  const { achievements, getUnlockedAchievements, loadAchievements } = useAchievementStore();

  useEffect(() => {
    if (uid) {
      loadXP(uid);
      loadBattlePass(uid);
      loadWorkouts?.(uid);
      loadRuns?.(uid);
      loadCompletedHikes?.(uid);
      loadNutritionData(uid);
      loadAllHealth(uid);
      loadAchievements(uid);
    }
  }, [uid]);

  const tierList = useRef(null);
  const [track,setTrack]=useState('Free');
  const [achCat, setAchCat] = useState('All');
  const [shownAch, setShownAch] = useState(ACH_FIRST);

  const xpLevel = getLevel ? getLevel() : 1;
  const seasonMaxTier = TIER_REWARDS.length;
  const currentLevelThreshold = getExpForLevel ? getExpForLevel(xpLevel) : 0;
  const nextLevelThreshold = getExpForLevel ? getExpForLevel(xpLevel + 1) : currentLevelThreshold + 1000;
  const xpIntoLevel = Math.max(0, (totalExp || 0) - currentLevelThreshold);
  const xpNeededForLevel = Math.max(1, nextLevelThreshold - currentLevelThreshold);
  const seasonPct = Math.min(100, Math.max(0, (xpIntoLevel / xpNeededForLevel) * 100));
  const xpRemaining = getExpToNextLevel ? getExpToNextLevel() : 0;

  const daysLeft = Math.max(0, SEASON_LENGTH_DAYS - Math.floor((Date.now() - SEASON_START.getTime()) / (1000*60*60*24)));

  const TIERS = useMemo(() => {
    const firstUnclaimedEligible = TIER_REWARDS.find(t => xpLevel >= t.t && !claimedTiers.includes(t.t));
    return TIER_REWARDS.map((t) => {
      const claimed = claimedTiers.includes(t.t);
      const eligible = xpLevel >= t.t;
      const current = !claimed && eligible && firstUnclaimedEligible?.t === t.t;
      return {
        ...t,
        claimed,
        current,
        locked: !eligible,
        xpNeeded: getExpForLevel ? getExpForLevel(t.t) : t.t * 1000,
      };
    });
  }, [xpLevel, claimedTiers]);

  // With a hundred tiers the row opens at the one to claim next (or the one after the last claimed), not at the first.
  const nextTierIndex = Math.max(0, TIERS.findIndex((t) => !t.claimed));
  const scrolledTo = useRef(-1);
  useEffect(() => {
    if (scrolledTo.current === nextTierIndex || !tierList.current) return;
    scrolledTo.current = nextTierIndex;
    if (nextTierIndex > 0) tierList.current.scrollToIndex({ index: Math.max(0, nextTierIndex - 1), animated: false });
  }, [nextTierIndex]);

  // A tier is claimed on the server, which checks the level in the person's XP ledger has reached it. The tier shows as claimed once the
  // server has recorded it, so a claim that fails or is turned away is said so here and the tier stays to be claimed.
  const handleClaim = async (tierNum) => {
    const status = await claimTier(tierNum);
    if (status === 'locked') {
      Alert.alert('Not Yet', 'Your level has not reached this tier yet.');
    } else if (status === 'failed') {
      Alert.alert('Could Not Claim', 'The tier could not be claimed. Check your connection and try again.');
    }
  };

  // A Premium reward is claimed on the server too, and what came of it is said here: the reward itself shows up in what the phone follows.
  const handlePremiumClaim = async (tier) => {
    const said = outcomeAlert(await premium.claimReward(tier), premiumRewardAt(tier));
    if (said) Alert.alert(said.title, said.message);
  };

  // The missions are worked out in lib/battlePassMissions.js, which the Battle Pass card on Home uses too. `meals` is in the list
  // so the meals mission moves when a meal is logged (getMealsByDate is the same function every time, so it never would).
  const missions = useMemo(() => {
    const now = new Date();
    return buildMissions({
      completedWorkouts,
      runs,
      completedHikes,
      steps,
      stepsDate,
      mealsToday: getMealsByDate ? getMealsByDate(localDateKey(now)) : [],
      now,
    });
  }, [completedWorkouts, runs, completedHikes, steps, stepsDate, getMealsByDate, meals]);

  const hoursUntilMidnight = useMemo(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.max(0, Math.ceil((midnight - now) / (1000 * 60 * 60)));
  }, []);

  const achCategories = useMemo(() => {
    const cats = new Set(achievements.map(a => a.category));
    return ['All', ...Array.from(cats)];
  }, [achievements]);

  // Days in a row with a workout, a run or a hike, worked out from those records (not a stored counter).
  const today = localDateKey();
  const currentStreak = useMemo(
    () => activityStreak(sessionsOf({ workouts: completedWorkouts, runs, hikes: completedHikes }), today).current,
    [completedWorkouts, runs, completedHikes, today],
  );

  // The workouts achievements count every finished workout there has ever been (the server's count), not just the newest 240 the phone holds.
  const lifetime = useMemo(() => lifetimeOf({ held: completedWorkouts, server: serverTotals }), [completedWorkouts, serverTotals]);

  const hikes = useMemo(() => hikeFacts(completedHikes), [completedHikes]);
  const achProgress = useMemo(() => {
    const facts = {
      finishedWorkouts: lifetime.finishedWorkouts,
      bestCalories: lifetime.bestCalories,
      streak: currentStreak,
      level: xpLevel,
      xp: totalExp || 0,
      hikeCount: hikes.count,
      hikeMiles: hikes.miles,
      strenuousHikes: hikes.strenuous,
    };
    const progress = {};
    achievements.forEach((a) => {
      progress[a.id] = progressFor(a.condition, facts);
    });
    return progress;
  }, [achievements, lifetime, currentStreak, xpLevel, totalExp, hikes]);

  // The achievements to list: the ones earned first (newest first), then the closest to earned (see lib/achievementProgress.js listOrder).
  // There are 300, so the list shows a few at first and grows by a page each time it is asked.
  const ordered = useMemo(
    () => listOrder(achCat === 'All' ? achievements : achievements.filter(a => a.category === achCat), achProgress),
    [achCat, achievements, achProgress],
  );
  const visibleAch = ordered.slice(0, shownAch);
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.logoRow}><Image source={require('@/assets/branding/zown-logo-512.png')} style={s.logo} resizeMode="contain" /></View>

        <View style={s.banner}>
          <Text style={s.seasonLabel}>SEASON 1</Text>
          <Text style={s.seasonTitle}>OWN THE DAY</Text>
          <Text style={s.seasonDate}>{SEASON_START.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
          <View style={s.seasonBarBg}><View style={[s.seasonBarFill,{width:seasonPct+'%'}]} /></View>
          <View style={s.seasonRow}><Text style={s.seasonLevel}>Level {xpLevel} / {seasonMaxTier}</Text><Text style={s.seasonDays}>{daysLeft} days left</Text></View>
        </View>

        <View style={s.xpRow}><Text style={s.xpLabel}>Current XP: <Text style={s.xpBold}>{(totalExp||0).toLocaleString()}</Text></Text><Text style={s.xpLabel}>Next Tier: <Text style={s.xpBold}>{xpRemaining.toLocaleString()} XP</Text></Text></View>

        <FlatList
          ref={tierList}
          testID="tier-list"
          horizontal
          data={TIERS}
          keyExtractor={(t) => String(t.t)}
          renderItem={({ item }) => <TierCard tier={item} busy={claiming === item.t} onClaim={() => handleClaim(item.t)} />}
          getItemLayout={(_, index) => ({ length: TIER_STEP, offset: TIER_STEP * index, index })}
          initialNumToRender={8}
          windowSize={5}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tierScroll}
          style={s.tierRow}
        />

        <View style={s.trackRow}>
          {['Free','Premium'].map(t=>(<Pressable key={t} style={[s.trackPill,track===t&&s.trackPillActive]} onPress={()=>setTrack(t)}><Text style={[s.trackText,track===t&&s.trackTextActive]}>{t} Track</Text></Pressable>))}
        </View>

        {track==='Premium' && (
          <PremiumRewards
            level={xpLevel}
            hasPass={hasPass}
            pass={premium.pass}
            claims={premium.claims}
            claiming={premium.claiming}
            onClaim={handlePremiumClaim}
            onOpenRewards={() => router.push('/rewards')}
            onGetPass={() => Alert.alert('Not Available Yet', 'Premium purchases aren\'t set up yet. Check back soon.')}
          />
        )}

        <View style={s.missionHeader}><Text style={s.sectionTitle}>Missions</Text><Text style={s.resetTimer}>Resets in {hoursUntilMidnight}h</Text></View>
        <Text style={s.missionGroup}>Daily</Text>
        {missions.daily.map((m,i)=><MissionRow key={i} m={m} />)}
        <Text style={s.missionGroup}>Weekly</Text>
        {missions.weekly.map((m,i)=><MissionRow key={i} m={m} />)}

        <View style={s.missionHeader}>
          <Text style={s.sectionTitle}>Achievements</Text>
          <Text style={s.resetTimer}>{getUnlockedAchievements().length}/{achievements.length}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingLeft:20,paddingRight:6,marginBottom:16}}>
          {achCategories.map(c => (
            <Pressable key={c} style={{backgroundColor: achCat === c ? '#000' : '#F0F0F0', paddingHorizontal:16, paddingVertical:8, borderRadius:20, marginRight:8}} onPress={() => { setAchCat(c); setShownAch(ACH_FIRST); }}>
              <Text style={{fontSize:13, fontWeight:'700', color: achCat === c ? '#FFF' : '#333'}}>{c === 'All' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',paddingHorizontal:20,marginBottom:12}}>
          {visibleAch.map(a => {
            const isEarned = !!a.unlockedAt;
            const prog = achProgress[a.id];
            return (
              <Pressable key={a.id} testID={`achievement-${a.id}`} accessibilityRole="button" onPress={() => router.push(achievementHref(a, prog))} style={{width:ACH_W,backgroundColor:'#FFF',borderRadius:16,padding:16,marginBottom:12,alignItems:'center',...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.04,shadowRadius:6,shadowOffset:{width:0,height:2}},android:{elevation:2},default:{}})}}>
                <View style={{width:72,height:72,marginBottom:8,justifyContent:'center',alignItems:'center'}}>
                  <BadgeMedal testID={`achievement-badge-${a.id}`} frame={a.badge?.frame} metal={a.badge?.metal} icon={a.badge?.icon} size={72} dim={!isEarned} />
                  {!isEarned && <View style={{position:'absolute',bottom:-2,right:-2,backgroundColor:'#FFF',borderRadius:8,padding:2}}><Ionicons name="lock-closed" size={12} color="#999" /></View>}
                </View>
                <Text style={{fontSize:13,fontWeight:'700',color:'#000',textAlign:'center',marginBottom:4}}>{a.name}</Text>
                {isEarned ? (
                  <Text style={{fontSize:12,fontWeight:'600',color:'#22C55E'}}>+{a.xpReward} XP</Text>
                ) : prog ? (
                  <Text style={{fontSize:11,color:'#999'}}>{Math.min(prog.current, prog.target)}/{prog.target}</Text>
                ) : (
                  <Text style={{fontSize:11,color:'#999',textAlign:'center'}}>{a.description}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {shownAch < ordered.length && (
          <Pressable style={{alignItems:'center',marginBottom:24}} onPress={() => setShownAch((n) => n + ACH_PAGE)}>
            <Text style={{fontSize:14,fontWeight:'700',color:'#000'}}>Show More Achievements ({ordered.length - shownAch} left)</Text>
          </Pressable>
        )}
        {shownAch > ACH_FIRST && (
          <Pressable style={{alignItems:'center',marginBottom:24}} onPress={() => setShownAch(ACH_FIRST)}>
            <Text style={{fontSize:14,fontWeight:'700',color:'#999'}}>Show Less</Text>
          </Pressable>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFFFFF'}, scroll:{flex:1}, scrollContent:{paddingBottom:100},
  logoRow:{alignItems:'center',marginTop:8,marginBottom:12}, logo:{width:120,height:36},
  banner:{backgroundColor:'#000',borderRadius:16,marginHorizontal:20,padding:20,marginBottom:20},
  seasonLabel:{fontSize:12,color:'#999',textTransform:'uppercase',letterSpacing:2},
  seasonTitle:{fontSize:28,fontWeight:'900',color:'#FFF',marginTop:4},
  seasonDate:{fontSize:13,color:'#666',marginTop:2,marginBottom:12},
  seasonBarBg:{height:6,borderRadius:3,backgroundColor:'#333',overflow:'hidden'},
  seasonBarFill:{height:6,borderRadius:3,backgroundColor:'#FFD700'},
  seasonRow:{flexDirection:'row',justifyContent:'space-between',marginTop:8},
  seasonLevel:{fontSize:12,fontWeight:'700',color:'#FFD700'},
  seasonDays:{fontSize:12,color:'#999'},
  xpRow:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:20,marginBottom:16},
  xpLabel:{fontSize:13,color:'#666'},
  xpBold:{fontWeight:'700',color:'#000'},
  tierRow:{flexGrow:0,marginBottom:20},
  tierScroll:{paddingLeft:20,paddingRight:6},
  tierCol:{alignItems:'center',marginRight:TIER_GAP},
  tierNum:{width:24,height:24,borderRadius:12,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center',marginBottom:4},
  tierNumText:{fontSize:11,fontWeight:'700',color:'#000'},
  tierBox:{width:TIER_W,height:160,borderRadius:12,padding:10,alignItems:'center',justifyContent:'center',borderWidth:2},
  tierName:{fontSize:11,fontWeight:'600',marginTop:6,textAlign:'center'},
  tierClaimed:{fontSize:8,fontWeight:'800',color:'#FFD700',marginTop:4},
  claimBtn:{backgroundColor:'#FFD700',paddingHorizontal:12,paddingVertical:4,borderRadius:8,marginTop:6},
  claimBtnText:{fontSize:10,fontWeight:'800',color:'#000'},
  tierXpNeed:{fontSize:10,color:'#999',marginTop:4},
  trackRow:{flexDirection:'row',gap:8,paddingHorizontal:20,marginBottom:16},
  trackPill:{flex:1,paddingVertical:10,borderRadius:20,backgroundColor:'#F0F0F0',alignItems:'center'},
  trackPillActive:{backgroundColor:'#000'},
  trackText:{fontSize:13,fontWeight:'700',color:'#333'},
  trackTextActive:{color:'#FFF'},
  missionHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,marginBottom:8},
  sectionTitle:{fontSize:18,fontWeight:'700',color:'#000'},
  resetTimer:{fontSize:12,color:'#999'},
  missionGroup:{fontSize:13,fontWeight:'600',color:'#999',textTransform:'uppercase',paddingHorizontal:20,marginTop:12,marginBottom:8},
  missionCard:{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderRadius:12,padding:14,marginHorizontal:20,marginBottom:8,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.04,shadowRadius:6,shadowOffset:{width:0,height:2}},android:{elevation:2},default:{shadowColor:'#000',shadowOpacity:0.04,shadowRadius:6,shadowOffset:{width:0,height:2}}})},
  missionInfo:{flex:1},
  missionTitle:{fontSize:14,fontWeight:'600',color:'#000',marginBottom:6},
  missionBarBg:{height:4,borderRadius:2,backgroundColor:'#E5E5E5',overflow:'hidden',marginBottom:4},
  missionBarFill:{height:4,borderRadius:2,backgroundColor:'#000'},
  missionProg:{fontSize:11,color:'#999'},
  missionXpBadge:{backgroundColor:'#F0F0F0',paddingHorizontal:10,paddingVertical:6,borderRadius:10,marginLeft:10},
  missionXpText:{fontSize:12,fontWeight:'700',color:'#000'},
});
