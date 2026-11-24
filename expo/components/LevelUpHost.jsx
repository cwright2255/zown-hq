// Shows the level-up pop-up when there is one waiting (store/levelUpStore.js). It is mounted once, in app/_layout.jsx, above every
// screen, so it comes up wherever the person is when the XP lands: on the workout's finish screen, a run's summary, the nutrition
// tab. It waits a moment first (lib/levelUp.js LEVEL_UP_DELAY_MS) so the screen that earned the XP has settled.
// Nothing is shown before the person has finished onboarding.
//
// A move that reaches a milestone (every fifth level) is a bigger celebration (components/LevelUpCelebration.jsx). For someone with the Premium
// Pass it also names the Premium reward that level opens, which is why this reads the pass from the premium store.
import React, { useEffect, useState } from 'react';
import LevelUpCelebration from '@/components/LevelUpCelebration';
import { LEVEL_UP_DELAY_MS, milestoneRewards, premiumRewardLine } from '@/lib/levelUp';
import { premiumPassActive } from '@/lib/premiumRewards';
import { useLevelUpStore } from '@/store/levelUpStore';
import { usePremiumStore } from '@/store/premiumStore';

export default function LevelUpHost({ enabled = true, delayMs = LEVEL_UP_DELAY_MS }) {
  const pending = useLevelUpStore((s) => s.pending);
  const dismiss = useLevelUpStore((s) => s.dismiss);
  const hasPass = usePremiumStore((s) => premiumPassActive(s.pass));
  const [visible, setVisible] = useState(false);
  const waiting = Boolean(pending);

  useEffect(() => {
    if (!enabled || !waiting) {
      setVisible(false);
      return undefined;
    }
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [enabled, waiting, delayMs]);

  if (!enabled || !pending || !visible) return null;
  const rewardLine = hasPass ? premiumRewardLine(milestoneRewards(pending.from, pending.to)) : null;
  return <LevelUpCelebration info={pending} onClose={dismiss} rewardLine={rewardLine} />;
}
