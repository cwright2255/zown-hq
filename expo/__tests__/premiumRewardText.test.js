// lib/premiumRewardText.js: what the Premium tab and My Rewards say, and which state each reward is in.
import {
  CODE_HELP, shortDate, rewardState, codeDetail, claimedLine, outcomeAlert, passLine, walletCodes, walletSummary,
} from '../lib/premiumRewardText';
import { PREMIUM_REWARDS, premiumRewardAt } from '../lib/premiumRewards';

// Local noon on the day, so the answer does not depend on the time zone the tests run in.
const local = (y, m, d) => new Date(y, m - 1, d, 12).toISOString();
const NOW = new Date(2026, 10, 23, 12);

describe('shortDate', () => {
  it('is the month and day, without the year when it is this one', () => {
    expect(shortDate(local(2026, 12, 1), NOW)).toBe('Dec 1');
    expect(shortDate(local(2026, 1, 31), NOW)).toBe('Jan 31');
  });

  it('adds the year when it is another', () => {
    expect(shortDate(local(2027, 2, 9), NOW)).toBe('Feb 9, 2027');
  });

  it('is null for what is not a date', () => {
    [null, undefined, 'soon', {}, NaN].forEach((v) => expect(shortDate(v, NOW)).toBeNull());
  });
});

describe('rewardState', () => {
  const reward = premiumRewardAt(20);
  const claim = { at: 'x', kind: 'shipping', code: 'ZSHIP-K7P2QX4M' };

  it('is claimed once there is a claim, whatever else is true', () => {
    expect(rewardState({ reward, claim, level: 1, hasPass: false })).toBe('claimed');
  });

  it('needs the pass first, even for a level that has been reached', () => {
    expect(rewardState({ reward, claim: undefined, level: 50, hasPass: false })).toBe('needs-pass');
    expect(rewardState({ reward, claim: undefined, level: 1, hasPass: false })).toBe('needs-pass');
  });

  it('is locked below the tier and ready from it, for a person with the pass', () => {
    expect(rewardState({ reward, claim: undefined, level: 19, hasPass: true })).toBe('locked');
    expect(rewardState({ reward, claim: undefined, level: 20, hasPass: true })).toBe('ready');
    expect(rewardState({ reward, claim: undefined, level: 80, hasPass: true })).toBe('ready');
  });

  it('is locked when the level is not a number', () => {
    expect(rewardState({ reward, claim: undefined, level: undefined, hasPass: true })).toBe('locked');
    expect(rewardState({ reward, claim: undefined, level: NaN, hasPass: true })).toBe('locked');
  });
});

describe('codeDetail', () => {
  it('says what each kind of code is for', () => {
    expect(codeDetail({ kind: 'discount', percent: 20 }, 50)).toBe('20% off a gear order');
    expect(codeDetail({ kind: 'shipping' }, 20)).toBe('Free shipping on a gear order');
    expect(codeDetail({ kind: 'colorway', number: 2 }, 60)).toBe('Exclusive Colorway 2');
    expect(codeDetail({ kind: 'shirt' }, 75)).toBe('A free shirt from the sale rack');
  });

  it('falls back on the list when the claim does not carry the number', () => {
    expect(codeDetail({ kind: 'discount' }, 90)).toBe('30% off a gear order');
    expect(codeDetail({ kind: 'colorway' }, 85)).toBe('Exclusive Colorway 3');
  });
});

describe('claimedLine', () => {
  it('says what a claim gave', () => {
    expect(claimedLine({ kind: 'aiMessages', amount: 25 })).toBe('+25 bonus AI messages');
    expect(claimedLine({ kind: 'scanCredit', amount: 1 })).toBe('+1 free body scan');
    expect(claimedLine({ kind: 'scanCredit', amount: 2 })).toBe('+2 free body scans');
    expect(claimedLine({ kind: 'discount', percent: 10, code: 'Z10-K7P2QX4M' })).toBe('Code Z10-K7P2QX4M');
    expect(claimedLine({ kind: 'shirt', code: 'ZSHIRT-K7P2QX4M' })).toBe('Code ZSHIRT-K7P2QX4M');
  });

  it('says when Legend runs until, and falls back on the days', () => {
    expect(claimedLine({ kind: 'legendTrial', days: 7, until: local(2026, 11, 30) }, NOW)).toBe('Legend until Nov 30');
    expect(claimedLine({ kind: 'legendTrial', days: 7 }, NOW)).toBe('7 days of Legend');
    expect(claimedLine({ kind: 'legendTrial', days: 1 }, NOW)).toBe('1 day of Legend');
  });

  it('is empty for nothing, a code that is missing or a kind it does not know', () => {
    expect(claimedLine(undefined)).toBe('');
    expect(claimedLine({ kind: 'shirt' })).toBe('');
    expect(claimedLine({ kind: 'mystery' })).toBe('');
  });
});

describe('outcomeAlert', () => {
  it('says what a claim did, by kind', () => {
    expect(outcomeAlert('claimed', premiumRewardAt(5))).toEqual({
      title: '25 Bonus AI Messages Claimed',
      message: "25 bonus AI messages are added. They are used when your day's own messages run out.",
    });
    expect(outcomeAlert('claimed', premiumRewardAt(15)).message).toBe('Your free body scan is ready. Find it on the Health screen.');
    expect(outcomeAlert('claimed', premiumRewardAt(25)).message).toBe('Legend is on for 7 days.');
    expect(outcomeAlert('claimed', premiumRewardAt(100)).message).toBe('Legend is on for 30 days.');
  });

  it('sends every code reward to My Rewards', () => {
    PREMIUM_REWARDS.filter((r) => ['discount', 'shipping', 'colorway', 'shirt'].includes(r.kind)).forEach((r) => {
      expect(outcomeAlert('claimed', r).message).toBe('Your code is waiting under My Rewards.');
    });
  });

  it('says each way a claim can be turned away', () => {
    const r = premiumRewardAt(25);
    expect(outcomeAlert('already', r).title).toBe('Already Claimed');
    expect(outcomeAlert('locked', r)).toEqual({ title: 'Not Yet', message: 'Your level has not reached this tier yet.' });
    expect(outcomeAlert('needs-pass', r).title).toBe('Premium Pass Needed');
    expect(outcomeAlert('failed', r).title).toBe('Could Not Claim');
  });

  it('says plainly that Legend days are not given over a plan, and that the reward waits', () => {
    const said = outcomeAlert('has-plan', premiumRewardAt(25));
    expect(said.title).toBe('You Already Have a Plan');
    expect(said.message).toMatch(/never replaced/);
    expect(said.message).toMatch(/stays here to claim/);
  });

  it('says nothing for a tap on a claim that is already on its way, or for an answer it does not know', () => {
    expect(outcomeAlert('busy', premiumRewardAt(5))).toBeNull();
    expect(outcomeAlert('whatever', premiumRewardAt(5))).toBeNull();
  });
});

describe('passLine', () => {
  it('is null without the pass', () => {
    expect(passLine({ active: true }, false, NOW)).toBeNull();
    expect(passLine(null, false, NOW)).toBeNull();
  });

  it('says the pass is active, with the end date when it has one', () => {
    expect(passLine({ active: true, expiresAt: null }, true, NOW)).toBe('Premium Pass active');
    expect(passLine({ active: true, expiresAt: local(2026, 12, 20) }, true, NOW)).toBe('Premium Pass active until Dec 20');
    expect(passLine(null, true, NOW)).toBe('Premium Pass active');
  });
});

describe('walletCodes', () => {
  const claims = {
    75: { kind: 'shirt', code: 'ZSHIRT-AAAAAAAA' },
    10: { kind: 'discount', percent: 10, code: 'Z10-BBBBBBBB' },
    5: { kind: 'aiMessages', amount: 25 },
    25: { kind: 'legendTrial', days: 7, until: 'x' },
    40: { kind: 'colorway', number: 1, code: 'ZCOLOR-CCCCCCCC' },
    20: { kind: 'shipping' },
  };

  it('lists the codes, lowest tier first, with what each is for', () => {
    expect(walletCodes(claims)).toEqual([
      { tier: 10, kind: 'discount', label: 'Discount code', code: 'Z10-BBBBBBBB', detail: '10% off a gear order' },
      { tier: 40, kind: 'colorway', label: 'Colorway code', code: 'ZCOLOR-CCCCCCCC', detail: 'Exclusive Colorway 1' },
      { tier: 75, kind: 'shirt', label: 'Free shirt code', code: 'ZSHIRT-AAAAAAAA', detail: 'A free shirt from the sale rack' },
    ]);
  });

  it('leaves out rewards that give no code, and a code kind with no code in it', () => {
    expect(walletCodes(claims).map((c) => c.tier)).not.toContain(5);
    expect(walletCodes(claims).map((c) => c.tier)).not.toContain(20);
  });

  it('is empty for nothing', () => {
    expect(walletCodes({})).toEqual([]);
    expect(walletCodes(null)).toEqual([]);
    expect(walletCodes(undefined)).toEqual([]);
  });
});

describe('walletSummary', () => {
  it('says what is left to use', () => {
    expect(walletSummary({ aiMessages: 75, scanCredits: 2 })).toEqual(['75 bonus AI messages left', '2 free body scans left']);
    expect(walletSummary({ aiMessages: 1, scanCredits: 1 })).toEqual(['1 bonus AI message left', '1 free body scan left']);
  });

  it('leaves out what has run out', () => {
    expect(walletSummary({ aiMessages: 0, scanCredits: 1 })).toEqual(['1 free body scan left']);
    expect(walletSummary({ aiMessages: 0, scanCredits: 0 })).toEqual([]);
  });
});

describe('the help under the codes', () => {
  it('says where a code goes and that it works once', () => {
    expect(CODE_HELP).toBe('Enter a code in the discount code box at checkout. Each code works once.');
  });
});
