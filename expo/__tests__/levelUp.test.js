// What the level-up pop-up says and how its confetti flies (lib/levelUp.js).
import {
  APEX, ARC_STEPS, CONFETTI_COLOR_COUNT, CONFETTI_COUNT, MILESTONE_CONFETTI_COUNT, MILESTONE_GOLD, MILESTONE_STEP, arcKeyframes, confettiPieces,
  formatXp, isMilestone, levelUpFacts, levelUpHeadline, levelsGained, mergeLevelUp, milestoneLine, milestoneRewards, milestonesCrossed,
  premiumRewardLine, sourceLabel,
} from '../lib/levelUp';
import { PREMIUM_REWARDS } from '../lib/premiumRewards';
import { KINDS, LEVEL_CAP, levelMultiplier, xpRequiredForLevel } from '../lib/xpRules';

describe('levelsGained', () => {
  it('counts the levels crossed', () => {
    expect(levelsGained(4, 5)).toBe(1);
    expect(levelsGained(4, 7)).toBe(3);
  });

  it('is 0 when the level does not go up, or either is not a number', () => {
    expect(levelsGained(5, 5)).toBe(0);
    expect(levelsGained(6, 5)).toBe(0);
    expect(levelsGained(undefined, 5)).toBe(0);
    expect(levelsGained(4, NaN)).toBe(0);
    expect(levelsGained('x', 'y')).toBe(0);
  });
});

describe('mergeLevelUp', () => {
  const first = { from: 4, to: 5, kind: 'workout', totalXp: 5200 };

  it('starts a pop-up from the first award', () => {
    expect(mergeLevelUp(null, first)).toEqual(first);
  });

  it('keeps the level the person started from, moves the end up and keeps the first award\'s kind', () => {
    const merged = mergeLevelUp(first, { from: 5, to: 6, kind: 'meal', totalXp: 6400 });
    expect(merged).toEqual({ from: 4, to: 6, kind: 'workout', totalXp: 6400 });
  });

  it('does not let a smaller later total pull the XP back', () => {
    expect(mergeLevelUp(first, { from: 4, to: 5, kind: 'meal', totalXp: 100 }).totalXp).toBe(5200);
  });

  it('leaves the pop-up as it was for something that is not a gain', () => {
    expect(mergeLevelUp(first, { from: 5, to: 5, kind: 'meal', totalXp: 9999 })).toBe(first);
    expect(mergeLevelUp(first, null)).toBe(first);
    expect(mergeLevelUp(null, { from: 5, to: 5 })).toBeNull();
  });

  it('takes the kind from a later award only when the first had none', () => {
    expect(mergeLevelUp({ from: 1, to: 2, kind: null, totalXp: 1000 }, { from: 2, to: 3, kind: 'run', totalXp: 2100 }).kind).toBe('run');
  });

  it('copes with a missing total', () => {
    expect(mergeLevelUp(null, { from: 1, to: 2, kind: 'run' }).totalXp).toBe(0);
  });
});

describe('levelUpFacts', () => {
  it('gives the XP multiplier the rules use for that level', () => {
    expect(levelUpFacts(1, 0).multiplier).toBe(1);
    expect(levelUpFacts(7, 8000).multiplier).toBe(Math.round(levelMultiplier(7) * 100) / 100);
    expect(levelUpFacts(LEVEL_CAP, 1e9).multiplier).toBe(5);
  });

  it('says how much XP is left for the next level and how far through this one the person is', () => {
    const total = xpRequiredForLevel(8) + 100;
    const facts = levelUpFacts(8, total);
    expect(facts.level).toBe(8);
    expect(facts.isMax).toBe(false);
    expect(facts.xpToNext).toBe(xpRequiredForLevel(9) - total);
    const span = xpRequiredForLevel(9) - xpRequiredForLevel(8);
    expect(facts.progress).toBeCloseTo(100 / span, 5);
  });

  it('has no progress at the very start of a level and none left over at the end of one', () => {
    expect(levelUpFacts(5, xpRequiredForLevel(5)).progress).toBe(0);
    expect(levelUpFacts(5, xpRequiredForLevel(6) - 1).progress).toBeGreaterThan(0.99);
  });

  it('rounds the XP still needed up to a whole number', () => {
    expect(levelUpFacts(5, xpRequiredForLevel(6) - 0.4).xpToNext).toBe(1);
  });

  it('is full, with nothing to go, at the top level', () => {
    const facts = levelUpFacts(LEVEL_CAP, 700000);
    expect(facts.isMax).toBe(true);
    expect(facts.xpToNext).toBe(0);
    expect(facts.progress).toBe(1);
  });

  it('keeps its numbers sensible for a missing or odd level and total', () => {
    for (const [level, total] of [[undefined, undefined], [0, -5], [NaN, 'x'], [1000, 5], [-3, 1e12]]) {
      const facts = levelUpFacts(level, total);
      expect(facts.level).toBeGreaterThanOrEqual(1);
      expect(facts.level).toBeLessThanOrEqual(LEVEL_CAP);
      expect(Number.isFinite(facts.multiplier)).toBe(true);
      expect(Number.isFinite(facts.xpToNext)).toBe(true);
      expect(facts.progress).toBeGreaterThanOrEqual(0);
      expect(facts.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe('levelUpHeadline', () => {
  it('names the level reached', () => {
    expect(levelUpHeadline(7, 8)).toBe('You reached Level 8');
  });

  it('says how many levels were jumped when it was more than one', () => {
    expect(levelUpHeadline(7, 10)).toBe('You jumped 3 levels, to Level 10');
  });

  it('says so at the top level, whether it was reached by one level or several', () => {
    expect(levelUpHeadline(LEVEL_CAP - 1, LEVEL_CAP)).toBe(`You reached Level ${LEVEL_CAP}, the top level`);
    expect(levelUpHeadline(90, LEVEL_CAP)).toBe(`You reached Level ${LEVEL_CAP}, the top level`);
  });
});

describe('sourceLabel and formatXp', () => {
  it('has a line for every kind of XP the rules know, and none for a kind it does not', () => {
    for (const kind of Object.keys(KINDS)) expect(sourceLabel(kind)).toEqual(expect.any(String));
    expect(sourceLabel('import')).toBeNull();
    expect(sourceLabel(undefined)).toBeNull();
    expect(sourceLabel('nonsense')).toBeNull();
  });

  it('writes XP as whole numbers with commas', () => {
    expect(formatXp(1234.6)).toBe('1,235');
    expect(formatXp(0)).toBe('0');
    expect(formatXp(1234567)).toBe('1,234,567');
    expect(formatXp(-4)).toBe('0');
    expect(formatXp(undefined)).toBe('0');
  });
});

describe('confetti', () => {
  it('makes the same pieces for the same seed, and others for another', () => {
    expect(confettiPieces(40, 5)).toEqual(confettiPieces(40, 5));
    expect(confettiPieces(40, 5)).not.toEqual(confettiPieces(40, 6));
  });

  it('makes as many pieces as asked, each with its own id', () => {
    const pieces = confettiPieces();
    expect(pieces).toHaveLength(CONFETTI_COUNT);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(CONFETTI_COUNT);
    expect(confettiPieces(3)).toHaveLength(3);
    expect(confettiPieces(0)).toEqual([]);
  });

  it('keeps every piece on the screen\'s scale, with a colour and a shape that exist', () => {
    for (const p of confettiPieces(200, 99)) {
      expect(Math.abs(p.dx)).toBeGreaterThanOrEqual(0.08);
      expect(Math.abs(p.dx)).toBeLessThanOrEqual(0.58);
      expect(p.up).toBeGreaterThanOrEqual(0.08);
      expect(p.up).toBeLessThanOrEqual(0.3);
      expect(p.fall).toBeGreaterThanOrEqual(0.35);
      expect(p.fall).toBeLessThanOrEqual(0.75);
      expect(p.delayMs).toBeGreaterThanOrEqual(0);
      expect(p.delayMs).toBeLessThanOrEqual(200);
      expect(p.durationMs).toBeGreaterThanOrEqual(1900);
      expect(p.durationMs).toBeLessThanOrEqual(3000);
      expect(Number.isInteger(p.turns)).toBe(true);
      expect(p.turns).not.toBe(0);
      expect(p.size).toBeGreaterThanOrEqual(6);
      expect(p.size).toBeLessThanOrEqual(12);
      expect(p.colorIndex).toBeGreaterThanOrEqual(0);
      expect(p.colorIndex).toBeLessThan(CONFETTI_COLOR_COUNT);
      expect([0, 1, 2]).toContain(p.shape);
    }
  });

  it('sends pieces both left and right', () => {
    const pieces = confettiPieces();
    expect(pieces.some((p) => p.dx < 0)).toBe(true);
    expect(pieces.some((p) => p.dx > 0)).toBe(true);
  });

  it('uses every colour', () => {
    const used = new Set(confettiPieces(200, 3).map((p) => p.colorIndex));
    expect(used.size).toBe(CONFETTI_COLOR_COUNT);
  });

  describe('arcKeyframes', () => {
    const piece = { dx: -0.3, up: 0.2, fall: 0.6 };
    const arc = arcKeyframes(piece);

    it('has one position for each moment, with the moments in order from 0 to 1', () => {
      expect(arc.input).toBe(ARC_STEPS);
      expect(arc.x).toHaveLength(ARC_STEPS.length);
      expect(arc.y).toHaveLength(ARC_STEPS.length);
      expect(arc.input[0]).toBe(0);
      expect(arc.input[arc.input.length - 1]).toBe(1);
      for (let i = 1; i < arc.input.length; i += 1) expect(arc.input[i]).toBeGreaterThan(arc.input[i - 1]);
    });

    it('starts at the badge, ends sideways by dx and down by fall', () => {
      expect(arc.x[0]).toBeCloseTo(0, 10);
      expect(arc.y[0]).toBeCloseTo(0, 10);
      expect(arc.x[arc.x.length - 1]).toBeCloseTo(piece.dx, 10);
      expect(arc.y[arc.y.length - 1]).toBeCloseTo(piece.fall, 10);
    });

    it('goes up by exactly `up` at the top of its arc, and no higher', () => {
      const apex = ARC_STEPS.indexOf(APEX);
      expect(arc.y[apex]).toBeCloseTo(-piece.up, 10);
      expect(Math.min(...arc.y)).toBeCloseTo(-piece.up, 10);
    });

    it('rises until the top of the arc, then only falls', () => {
      const apex = ARC_STEPS.indexOf(APEX);
      for (let i = 1; i <= apex; i += 1) expect(arc.y[i]).toBeLessThan(arc.y[i - 1]);
      for (let i = apex + 1; i < arc.y.length; i += 1) expect(arc.y[i]).toBeGreaterThan(arc.y[i - 1]);
    });

    it('slows down sideways as it goes', () => {
      const steps = arc.x.map((v, i) => (i === 0 ? 0 : Math.abs(v - arc.x[i - 1]) / (arc.input[i] - arc.input[i - 1])));
      for (let i = 2; i < steps.length; i += 1) expect(steps[i]).toBeLessThanOrEqual(steps[i - 1] + 1e-9);
    });

    it('makes finite numbers for every piece of a burst', () => {
      for (const p of confettiPieces(CONFETTI_COUNT)) {
        const { x, y } = arcKeyframes(p);
        for (const v of [...x, ...y]) expect(Number.isFinite(v)).toBe(true);
      }
    });
  });
});

describe('milestones', () => {
  it('are every fifth level, 5 to 100', () => {
    expect(MILESTONE_STEP).toBe(5);
    expect(milestonesCrossed(0, LEVEL_CAP)).toHaveLength(20);
    expect(milestonesCrossed(0, LEVEL_CAP)).toEqual(Array.from({ length: 20 }, (_, i) => (i + 1) * 5));
  });

  it('are reached by a level-up that lands on one', () => {
    [5, 10, 25, 50, 95, 100].forEach((to) => {
      expect(milestonesCrossed(to - 1, to)).toEqual([to]);
      expect(isMilestone(to - 1, to)).toBe(true);
    });
  });

  it('are not reached by the levels between them', () => {
    [2, 3, 4, 6, 7, 8, 9, 11, 14, 44, 96, 99].forEach((to) => {
      expect(milestonesCrossed(to - 1, to)).toEqual([]);
      expect(isMilestone(to - 1, to)).toBe(false);
    });
  });

  it('are reached too by a jump that passes over one, and all that it passes are counted', () => {
    expect(milestonesCrossed(3, 7)).toEqual([5]);
    expect(milestonesCrossed(8, 12)).toEqual([10]);
    expect(milestonesCrossed(3, 16)).toEqual([5, 10, 15]);
    expect(milestonesCrossed(5, 9)).toEqual([]); // from is the level already reached: its milestone was celebrated then
    expect(milestonesCrossed(5, 10)).toEqual([10]);
  });

  it('are none when the level does not go up, or is not a number', () => {
    expect(milestonesCrossed(10, 10)).toEqual([]);
    expect(milestonesCrossed(12, 8)).toEqual([]);
    [[undefined, 10], [10, undefined], ['a', 5], [NaN, NaN]].forEach(([a, b]) => expect(milestonesCrossed(a, b)).toEqual([]));
  });

  it('stop at the top level', () => {
    expect(milestonesCrossed(97, 140)).toEqual([100]);
    expect(milestonesCrossed(LEVEL_CAP, LEVEL_CAP + 5)).toEqual([]);
  });

  it('start at the first level, whatever is passed as the level before it', () => {
    expect(milestonesCrossed(-3, 5)).toEqual([5]);
    expect(milestonesCrossed(0, 4)).toEqual([]);
  });

  it('have a Premium reward on every one, and no Premium reward anywhere else', () => {
    const all = milestonesCrossed(0, LEVEL_CAP);
    expect(PREMIUM_REWARDS.map((r) => r.tier)).toEqual(all);
  });
});

describe('milestoneLine', () => {
  it('says the level is a milestone when the move lands on it', () => {
    expect(milestoneLine(24, 25)).toBe('Level 25 is a milestone');
    expect(milestoneLine(2, 5)).toBe('Level 5 is a milestone');
  });

  it('says a milestone was passed when the move lands past it', () => {
    expect(milestoneLine(4, 7)).toBe('You passed the Level 5 milestone');
  });

  it('lists the milestones when it passed several', () => {
    expect(milestoneLine(3, 11)).toBe('You passed milestones 5 and 10');
    expect(milestoneLine(3, 16)).toBe('You passed milestones 5, 10 and 15');
    expect(milestoneLine(0, 30)).toBe('You passed milestones 5, 10, 15, 20, 25 and 30');
  });

  it('is null when there is no milestone', () => {
    expect(milestoneLine(7, 8)).toBeNull();
    expect(milestoneLine(8, 8)).toBeNull();
  });
});

describe('the Premium rewards at a milestone', () => {
  it('are the ones on the milestones the move reaches', () => {
    expect(milestoneRewards(24, 25).map((r) => r.name)).toEqual(['7 Days of Legend']);
    expect(milestoneRewards(4, 10).map((r) => r.tier)).toEqual([5, 10]);
    expect(milestoneRewards(7, 8)).toEqual([]);
  });

  it('are named in one line, for one, a few or many', () => {
    expect(premiumRewardLine(milestoneRewards(49, 50))).toBe('Premium reward ready: 20% Off Gear');
    expect(premiumRewardLine(milestoneRewards(4, 10))).toBe('Premium rewards ready: 25 Bonus AI Messages and 10% Off Gear');
    expect(premiumRewardLine(milestoneRewards(4, 15))).toBe('Premium rewards ready: 25 Bonus AI Messages, 10% Off Gear and Free Body Scan');
    expect(premiumRewardLine(milestoneRewards(4, 30))).toBe('6 Premium rewards ready');
  });

  it('have no line when there are none', () => {
    expect(premiumRewardLine([])).toBeNull();
    expect(premiumRewardLine(null)).toBeNull();
    expect(premiumRewardLine(undefined)).toBeNull();
  });
});

describe('the milestone confetti', () => {
  it('is more than an ordinary level-up gets, and gold is the colour of the milestone', () => {
    expect(MILESTONE_CONFETTI_COUNT).toBeGreaterThan(CONFETTI_COUNT);
    expect(MILESTONE_GOLD).toBe('#FFD700');
    const pieces = confettiPieces(MILESTONE_CONFETTI_COUNT, 20261123, 6);
    expect(pieces).toHaveLength(MILESTONE_CONFETTI_COUNT);
    expect(new Set(pieces.map((p) => p.colorIndex))).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    pieces.forEach((p) => expect(p.colorIndex).toBeLessThan(6));
  });
});
