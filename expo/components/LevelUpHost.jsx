// Shows the level-up pop-up when there is one waiting (store/levelUpStore.js). It is mounted once, in app/_layout.jsx, above every
// screen, so it comes up wherever the person is when the XP lands: on the workout's finish screen, a run's summary, the nutrition
// tab. It waits a moment first (lib/levelUp.js LEVEL_UP_DELAY_MS) so the screen that earned the XP has settled.
// Nothing is shown before the person has finished onboarding.
import React, { useEffect, useState } from 'react';
import LevelUpCelebration from '@/components/LevelUpCelebration';
import { LEVEL_UP_DELAY_MS } from '@/lib/levelUp';
import { useLevelUpStore } from '@/store/levelUpStore';

export default function LevelUpHost({ enabled = true, delayMs = LEVEL_UP_DELAY_MS }) {
  const pending = useLevelUpStore((s) => s.pending);
  const dismiss = useLevelUpStore((s) => s.dismiss);
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
  return <LevelUpCelebration info={pending} onClose={dismiss} />;
}
