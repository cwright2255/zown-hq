// lib/premiumRewardText.js
//
// The words and the little decisions on the Premium side of the Battle Pass and on the My Rewards screen: what state a reward is in, what a
// claim says, what the alerts say, which codes a person holds. Pure functions, so every line is checked in a test and the screens only draw.
// The rewards themselves are in lib/premiumRewards.js and are handed out by the server (functions/src/premiumPass.js).
import { CODE_KINDS, CODE_LABELS, premiumRewardAt } from './premiumRewards';

/** Under the list of codes: how one is used. */
export const CODE_HELP = 'Enter a code in the discount code box at checkout. Each code works once.';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** A date as "Dec 1" (with the year when it is not this one), in the person's own time zone. Null when it is not a date. */
export function shortDate(value, now = new Date()) {
  const d = new Date(value);
  if (value == null || Number.isNaN(d.getTime())) return null;
  const text = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? text : `${text}, ${d.getFullYear()}`;
}

/**
 * Where a reward stands for this person:
 *   'claimed'    it has been claimed (the claim is kept, so it stays claimed whatever happens to the pass)
 *   'needs-pass' they do not have the Premium Pass
 *   'locked'     they have it but their level has not reached the tier
 *   'ready'      they can claim it now
 */
export function rewardState({ reward, claim, level, hasPass }) {
  if (claim) return 'claimed';
  if (!hasPass) return 'needs-pass';
  if (!(level >= reward.tier)) return 'locked';
  return 'ready';
}

/** What a single-use code is for, as the My Rewards screen says it. */
export function codeDetail(claim, tier) {
  const reward = premiumRewardAt(tier) || {};
  const percent = claim.percent || reward.percent;
  const number = claim.number || reward.number;
  switch (claim.kind) {
    case 'discount': return `${percent}% off a gear order`;
    case 'shipping': return 'Free shipping on a gear order';
    case 'colorway': return `Exclusive Colorway ${number}`;
    default: return 'A free shirt from the sale rack';
  }
}

/** The line on a claimed reward: what it gave. */
export function claimedLine(claim, now = new Date()) {
  if (!claim) return '';
  switch (claim.kind) {
    case 'aiMessages': return `+${claim.amount} bonus AI messages`;
    case 'scanCredit': return `+${plural(claim.amount, 'free body scan', 'free body scans')}`;
    case 'legendTrial': {
      const until = shortDate(claim.until, now);
      return until ? `Legend until ${until}` : `${plural(claim.days, 'day', 'days')} of Legend`;
    }
    default: return CODE_KINDS.includes(claim.kind) && claim.code ? `Code ${claim.code}` : '';
  }
}

/** The alert after a claim, for the answer the store gives. Null when there is nothing to say (a second tap while the first is on its way). */
export function outcomeAlert(status, reward) {
  switch (status) {
    case 'claimed': {
      const what = {
        aiMessages: `${reward.amount} bonus AI messages are added. They are used when your day's own messages run out.`,
        scanCredit: 'Your free body scan is ready. Find it on the Health screen.',
        legendTrial: `Legend is on for ${plural(reward.days, 'day', 'days')}.`,
      }[reward.kind] || 'Your code is waiting under My Rewards.';
      return { title: `${reward.name} Claimed`, message: what };
    }
    case 'already': return { title: 'Already Claimed', message: 'You have already claimed this reward.' };
    case 'locked': return { title: 'Not Yet', message: 'Your level has not reached this tier yet.' };
    case 'needs-pass': return { title: 'Premium Pass Needed', message: 'Premium rewards are for people with the Premium Pass.' };
    case 'has-plan':
      return {
        title: 'You Already Have a Plan',
        message: 'Legend days are given to people on the Free plan, and your plan is never replaced. The reward stays here to claim if you are ever on Free.',
      };
    case 'failed': return { title: 'Could Not Claim', message: 'The reward could not be claimed. Check your connection and try again.' };
    default: return null;
  }
}

/** The line on the Premium Pass card when the person has the pass, or null when they do not (the card then offers it). */
export function passLine(pass, active, now = new Date()) {
  if (!active) return null;
  const until = pass && pass.expiresAt != null ? shortDate(pass.expiresAt, now) : null;
  return until ? `Premium Pass active until ${until}` : 'Premium Pass active';
}

/** The single-use codes a person holds, lowest tier first: { tier, kind, label, code, detail }. */
export function walletCodes(claims) {
  return Object.entries(claims || {})
    .filter(([, claim]) => claim && CODE_KINDS.includes(claim.kind) && typeof claim.code === 'string' && claim.code)
    .map(([tier, claim]) => ({
      tier: Number(tier), kind: claim.kind, label: CODE_LABELS[claim.kind], code: claim.code, detail: codeDetail(claim, Number(tier)),
    }))
    .sort((a, b) => a.tier - b.tier);
}

/** What the person has left to use: the bonus messages and free scans, one line each, and none for a count of nothing. */
export function walletSummary({ aiMessages, scanCredits }) {
  const lines = [];
  if (aiMessages > 0) lines.push(`${aiMessages} bonus AI ${aiMessages === 1 ? 'message' : 'messages'} left`);
  if (scanCredits > 0) lines.push(`${plural(scanCredits, 'free body scan', 'free body scans')} left`);
  return lines;
}
