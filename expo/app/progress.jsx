import LoadingSkeleton from '@/src/components/LoadingSkeleton';
import EmptyState from '@/src/components/EmptyState';
import ProgressWeekCard from '@/components/ProgressWeekCard';
import ProgressWeightCard from '@/components/ProgressWeightCard';
import ProgressScansCard from '@/components/ProgressScansCard';
import ProgressGoals from '@/components/ProgressGoals';
import GoalEditorModal from '@/components/GoalEditorModal';
import ProgressMonthCard from '@/components/ProgressMonthCard';
import PromptModal from '@/components/PromptModal';
import React, { useState, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, Image, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHealthStore } from '@/store/healthStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useUserStore } from '@/store/userStore';
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';
import { useGoalsStore } from '@/store/goalsStore';
import { useWeightLogStore } from '@/store/weightLogStore';
import { useHikingStore } from '@/store/hikingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useExpStore } from '@/store/expStore';
import { useActivityStreak } from '@/services/streakService';
import { LEVEL_CAP } from '@/lib/xpRules';
import { trackedGoalUpdates } from '@/lib/goalTracking';
import { monthlyTotals, weekStrip, weekSummary } from '@/lib/progressInsights';
// WEIGHT_DATA_LIVE removed - now sourced from useWeightLogStore (real Firestore data)
// GOALS_LIVE removed - now sourced from useGoalsStore (real Firestore data)
// MEASUREMENTS removed - now sourced from real scan data (waist/hip/shoulder are the only measurements bodyCompositionService.js actually computes)
// MONTHLY removed - now computed live from real workout/run records

export default function ProgressScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { loadAllHealth } = useHealthStore();
  const { user, updateUser, saveProfile } = useUserStore();

  const { scans, loadScans } = useBodyCompositionStore();
  useEffect(() => {
    if (user?.uid && scans.length === 0) loadScans(user.uid);
  }, [user?.uid]);
  const { goals, loadGoals, addGoal, updateGoal, updateGoalProgress, deleteGoal } = useGoalsStore();
  useEffect(() => {
    if (user?.uid && goals.length === 0) loadGoals(user.uid);
  }, [user?.uid]);
  const { completedWorkouts } = useWorkoutStore();
  const { runs } = useRunningStore();
  const { logs: weightLogs, loadLogs: loadWeightLogs, addLog: addWeightLog } = useWeightLogStore();
  useEffect(() => {
    if (user?.uid && weightLogs.length === 0) loadWeightLogs(user.uid);
  }, [user?.uid]);
  const completedHikes = useHikingStore((s) => s.completedHikes);
  const units = useSettingsStore((s) => s.units);
  const streak = useActivityStreak();
  const { getLevel, getExpToNextLevel } = useExpStore();

  // The week, the six months and the goals the app counts all read the same workouts and runs, as of one moment.
  const now = new Date();
  const activity = { workouts: completedWorkouts, runs, now };
  const week = weekSummary(activity);
  const strip = weekStrip({ ...activity, hikes: completedHikes });
  const monthly = monthlyTotals(activity);
  const monthName = now.toLocaleDateString('en-US', { month: 'long' });
  const level = getLevel();
  const levelLine = level >= LEVEL_CAP ? 'Top level' : `${Math.round(getExpToNextLevel()).toLocaleString('en-US')} XP to Level ${level + 1}`;

  // A goal the app counts itself (3 workouts this week) is kept up to date in the goal too, because the calendar and the Coach read the
  // stored number. Each number is written once; a write that fails is tried again the next time the records change.
  const syncedGoals = useRef({});
  useEffect(() => {
    trackedGoalUpdates(goals, activity).forEach(({ id, current }) => {
      if (syncedGoals.current[id] === current) return;
      syncedGoals.current[id] = current;
      Promise.resolve(updateGoalProgress(id, current)).catch(() => { delete syncedGoals.current[id]; });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, completedWorkouts, runs]);

  const latestScan = scans.length ? scans[scans.length - 1] : null;

  // Custom-styled modal state, replacing Alert.prompt (a native iOS-only
  // dialog that can't be restyled). activeModal is null | 'logWeight' |
  // 'targetWeight' - only one flow open at a time. Goals have their own
  // form (components/GoalEditorModal.jsx), below.
  const [activeModal, setActiveModal] = useState(null);

  // The goal form: closed, open for a new goal (id null), or open for one being edited.
  const [goalEditor, setGoalEditor] = useState({ open: false, id: null });
  const editingGoal = goalEditor.id ? goals.find((g) => g.id === goalEditor.id) || null : null;
  const openAddGoal = () => setGoalEditor({ open: true, id: null });
  const openEditGoal = (id) => setGoalEditor({ open: true, id });
  const closeGoalEditor = () => setGoalEditor({ open: false, id: null });

  // Saving throws when it fails (no network, not signed in): the form shows the message and stays open.
  const saveGoal = async (fields) => {
    if (goalEditor.id) await updateGoal(goalEditor.id, fields);
    else await addGoal({ uid: user?.uid, ...fields });
    closeGoalEditor();
  };

  const completeGoal = async (id) => {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    try {
      await updateGoal(id, { completed: true, current: Math.max(Number(goal.current) || 0, Number(goal.target) || 0) });
    } catch (e) {
      Alert.alert("Couldn't update goal", e?.message || 'Please try again.');
    }
  };

  const confirmDeleteGoal = (id) => {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    Alert.alert('Delete goal', `Delete "${goal.title}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGoal(id);
          } catch (e) {
            Alert.alert("Couldn't delete goal", e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const promptForTargetWeight = () => setActiveModal('targetWeight');

  const submitTargetWeight = async (values) => {
    const targetLbs = parseFloat(values.targetWeight);
    if (!targetLbs || Number.isNaN(targetLbs)) {
      setActiveModal(null);
      return;
    }
    const targetWeightKg = Math.round((targetLbs / 2.20462) * 10) / 10;
    updateUser({ targetWeightKg });
    if (user?.uid) saveProfile(user.uid);
    setActiveModal(null);
  };

  const handleLogWeight = () => setActiveModal('logWeight');

  const submitLogWeight = async (values) => {
    const weightLbs = parseFloat(values.weight);
    if (!weightLbs || Number.isNaN(weightLbs)) {
      Alert.alert('Invalid weight', 'Please enter a number.');
      return;
    }
    const weightKg = Math.round((weightLbs / 2.20462) * 10) / 10;
    try {
      await addWeightLog(user?.uid, weightKg);
      updateUser({ weightKg });
      if (user?.uid) saveProfile(user.uid);
      if (user?.targetWeightKg == null) {
        setActiveModal('targetWeight');
      } else {
        setActiveModal(null);
      }
    } catch (e) {
      Alert.alert("Couldn't log weight", e?.message || 'Please try again.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setIsLoading(true);
    try {
      if (user?.uid) {
        await loadAllHealth(user.uid);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };
return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }>
        <View style={s.logoRow}><Image source={require('@/assets/branding/zown-logo-512.png')} style={s.logo} resizeMode="contain" /></View>
        <Text style={s.pageTitle}>Progress</Text>

        <ProgressWeekCard summary={week} strip={strip} streak={streak.current} />

        <ProgressWeightCard
          logs={weightLogs}
          targetKg={user?.targetWeightKg ?? null}
          now={now}
          onLog={handleLogWeight}
          onSetTarget={promptForTargetWeight}
        />

        <ProgressScansCard scans={scans} />

        <ProgressGoals
          goals={goals}
          activity={activity}
          onAdd={openAddGoal}
          onEdit={openEditGoal}
          onComplete={completeGoal}
          onDelete={confirmDeleteGoal}
        />

        {/* Measurements - waist/hip/shoulder are the only fields
            bodyCompositionService.js actually computes per scan; no
            chest/arm/thigh data exists anywhere in the app, so those
            rows were dropped rather than shown with fabricated values. */}
        <View style={s.sectionRow}><Text style={s.sectionTitle}>Measurements</Text></View>
        <View style={s.card}>
          {(() => {
            if (!latestScan) {
              return <Text style={{ fontSize: 13, color: '#999' }}>No scan yet.</Text>;
            }
            const prevScan = scans.length > 1 ? scans[scans.length - 2] : null;
            const rows = [
              ['waistCircumferenceCm', 'Waist'],
              ['hipCircumferenceCm', 'Hip'],
              ['shoulderWidthCm', 'Shoulder width'],
            ].map(([key, label]) => {
              const val = latestScan.measurements?.[key];
              const prevVal = prevScan?.measurements?.[key];
              const delta = (typeof val === 'number' && typeof prevVal === 'number') ? val - prevVal : null;
              return { key, label, val, delta };
            }).filter((r) => r.val != null);
            return rows.map((r, i) => (
              <View key={r.key} style={[s.measRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={s.measLabel}>{r.label}</Text>
                <Text style={s.measValue}>{r.val} cm</Text>
                {r.delta != null && r.delta !== 0 ? (
                  <Text style={[s.measChange, { color: r.delta < 0 ? '#22C55E' : '#F97316' }]}>
                    {(r.delta > 0 ? '\u2191 ' : '\u2193 ') + Math.abs(r.delta).toFixed(1) + ' cm'}
                  </Text>
                ) : (
                  <Text style={s.measChange}> </Text>
                )}
              </View>
            ));
          })()}
        </View>

        <ProgressMonthCard totals={monthly} monthName={monthName} level={level} levelLine={levelLine} />
      </ScrollView>
      <GoalEditorModal
        visible={goalEditor.open}
        goal={editingGoal}
        units={units}
        onCancel={closeGoalEditor}
        onSave={saveGoal}
      />
      <PromptModal
        visible={activeModal === 'logWeight'}
        title="Log Weight"
        submitLabel="Save"
        fields={[
          { key: 'weight', label: 'Enter your current weight (lbs)', placeholder: 'e.g. 175', keyboardType: 'numeric' },
        ]}
        onCancel={() => setActiveModal(null)}
        onSubmit={submitLogWeight}
      />
      <PromptModal
        visible={activeModal === 'targetWeight'}
        title="Target Weight"
        submitLabel="Save"
        fields={[
          { key: 'targetWeight', label: 'What weight are you working towards? (lbs)', placeholder: 'e.g. 170', keyboardType: 'numeric' },
        ]}
        onCancel={() => setActiveModal(null)}
        onSubmit={submitTargetWeight}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFFFFF'}, scroll:{flex:1}, scrollContent:{paddingBottom:100},
  logoRow:{alignItems:'center',marginTop:8,marginBottom:12}, logo:{width:120,height:36},
  pageTitle:{fontSize:24,fontWeight:'800',color:'#000',paddingHorizontal:20,marginBottom:8},
  sectionTitle:{fontSize:18,fontWeight:'700',color:'#000',paddingHorizontal:20,marginTop:16,marginBottom:10},
  sectionRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,marginTop:16,marginBottom:10},
  card:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:16,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  goalCard:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginHorizontal:20,marginBottom:12,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  measRow:{flexDirection:'row',alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  measLabel:{fontSize:14,fontWeight:'600',color:'#000',flex:1},
  measValue:{fontSize:14,fontWeight:'700',color:'#000',marginRight:12},
  measChange:{fontSize:13,fontWeight:'600'},
});
