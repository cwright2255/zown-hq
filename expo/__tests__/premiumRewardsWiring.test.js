// The Premium side of the Battle Pass is held together by pieces in different places: the function that claims, the body scan function that
// spends a free scan, the rules that keep the pass and the claims out of the phone's reach, the account erasure that removes the codes, the
// screen the phone shows them on. Each reads a source file, because these need more around them than a test can give. (The rules themselves are
// tried against the Firestore emulator by rules-tests/users.test.js and default-deny.test.js, which run in CI.)
const fs = require('fs');
const path = require('path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
const index = read('functions', 'src', 'index.js');
const rules = read('firestore.rules');
const between = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to));

describe('the claimPremiumReward function', () => {
  const fn = between(index, 'export const claimPremiumReward', '// The person\'s invite code');

  it('is exported, and signs the person in first', () => {
    expect(index).toMatch(/export const claimPremiumReward = onCall\(/);
    expect(fn).toMatch(/const uid = requireAuth\(req\.auth\);/);
  });

  it('takes the person from the sign-in and only the tier from the request, never a person', () => {
    expect(fn).toMatch(/claimPremiumRewardFor\(\{ db: getFirestore\(\), uid, tier \}\)/);
    expect(fn).toMatch(/const tier = req\.data && req\.data\.tier;/);
    expect(fn).not.toMatch(/req\.data\.uid|req\.data\.level|req\.data\.pass|req\.data\.code/);
  });

  it('turns a tier that has no reward away as an invalid argument, and returns every other answer', () => {
    expect(fn).toMatch(/if \(result\.status === 'invalid'\) throw new HttpsError\('invalid-argument'/);
    expect(fn).toMatch(/return result;/);
  });

  it('uses the claim logic and the wallet from their own files', () => {
    expect(index).toMatch(/import \{ claimPremiumReward as claimPremiumRewardFor \} from '\.\/premiumPass\.js';/);
    expect(index).toMatch(/import \{ scanCreditsOf, takeScanCredit \} from '\.\/rewardsWallet\.js';/);
  });
});

describe('the body scan function and a free scan', () => {
  const scan = between(index, 'export const generateBodyCompositionInsight', 'export const getNutritionRecommendations');

  it('lets in a plan that includes the scan, or a person with a free scan, and turns everyone else away', () => {
    expect(scan).toMatch(/const viaFreeScan = await requireBodyScan\(uid\);/);
    expect(index).not.toMatch(/requireFeature\(uid, 'bodyScan'\)/);
  });

  it('uses the free scan up only once the insight is made, so a scan that fails costs nothing', () => {
    const made = scan.indexOf('suggestion: parsed.suggestion');
    const spent = scan.indexOf('takeScanCredit(');
    const saved = scan.indexOf('saveRecommendation(');
    expect(made).toBeGreaterThan(-1);
    expect(spent).toBeGreaterThan(made);
    expect(saved).toBeGreaterThan(spent);
    expect(scan).toMatch(/if \(viaFreeScan\) \{\s*(?:\/\/[^\n]*\n\s*)*const taken = await takeScanCredit\(\{ db: getFirestore\(\), uid \}\);\s*if \(!taken\.ok\) throw planRequired\('bodyScan', \{ needs: 'legend', tier: 'free' \}\);/);
  });

  it('does not touch the free scans of a person whose plan includes the scan', () => {
    const gate = between(index, 'async function requireBodyScan', 'function aiLimitReached');
    expect(gate.indexOf('if (gate.ok) return false;')).toBeLessThan(gate.indexOf('scanCreditsOf'));
    expect(gate).toMatch(/\(await scanCreditsOf\(db, uid\)\) >= 1\) return true;\s*throw planRequired\('bodyScan', gate\);/);
  });
});

describe('the rules', () => {
  it('keep the Premium Pass and the Premium rewards out of the phone\'s reach, with the other documents the server writes', () => {
    expect(rules).toMatch(/!\(docId in \['achievements', 'badges', 'battlePass', 'premiumPass', 'premiumRewards'\]\)/);
  });

  it('have no rule for the shop codes, so they are closed to everyone but the functions', () => {
    expect(rules).not.toMatch(/rewardCodes/);
    expect(read('rules-tests', 'default-deny.test.js')).toMatch(/'rewardCodes\/Z10-K7P2QX4M'/);
  });

  it('are tried for both documents against the emulator', () => {
    expect(read('rules-tests', 'users.test.js')).toMatch(/describe\.each\(\['achievements', 'badges', 'battlePass', 'premiumPass', 'premiumRewards'\]\)/);
  });
});

describe('the phone', () => {
  it('writes neither document: it only follows them', () => {
    const files = [];
    const walk = (dir) => fs.readdirSync(path.join(__dirname, '..', dir), { withFileTypes: true }).forEach((e) => {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else if (/\.jsx?$/.test(e.name)) files.push(rel);
    });
    ['app', 'components', 'store', 'services', 'lib', 'hooks'].forEach(walk);
    const writers = files.filter((f) => /(setDoc|updateDoc|deleteDoc|writeBatch)/.test(read(f)) && /premium(Pass|Rewards)/.test(read(f)));
    expect(writers).toEqual([]);
  });

  it('follows both documents from sign-in to sign-out', () => {
    const sync = read('services', 'progressSync.js');
    expect(sync).toMatch(/follow\(uid, \['data', 'premiumPass'\]/);
    expect(sync).toMatch(/follow\(uid, \['data', 'premiumRewards'\]/);
    expect(sync).toMatch(/usePremiumStore\.getState\(\)\.clearServerRewards\(\)/);
  });

  it('knows the My Rewards screen', () => {
    expect(read('app', '_layout.jsx')).toMatch(/<Stack\.Screen name="rewards" \/>/);
    expect(fs.existsSync(path.join(__dirname, '..', 'app', 'rewards.jsx'))).toBe(true);
  });

  it('shows the Premium rewards on the Battle Pass, and the free-scan count on the Health screen', () => {
    expect(read('app', 'battlepass.jsx')).toMatch(/<PremiumRewards\b/);
    expect(read('app', 'battlepass.jsx')).toMatch(/onOpenRewards=\{\(\) => router\.push\('\/rewards'\)\}/);
    expect(read('app', 'health.jsx')).toMatch(/bodyScanCard\(\{ latestScan, locked: ready && !can\('bodyScan'\), freeScans \}\)/);
  });
});

describe('erasing an account', () => {
  it('removes the shop codes the person was given', () => {
    expect(read('functions', 'src', 'accountErasure.js')).toMatch(/run\('rewardCodes', \(\) => deleteQuery\(db, \(\) => db\.collection\('rewardCodes'\)\.where\('uid', '==', uid\)\)\)/);
  });
});

describe('the docs', () => {
  const doc = read('docs', 'DEVICE_CHECKS.md');

  it('have a section for the Premium side, with the order to deploy in and what it does not do', () => {
    expect(doc).toMatch(/## Premium Battle Pass rewards/);
    expect(doc).toMatch(/firebase deploy --only functions:claimPremiumReward,functions:generateBodyCompositionInsight,functions:postLLM,functions:deleteMyAccount/);
    expect(doc).toMatch(/firebase deploy --only firestore:rules/);
    expect(doc).toMatch(/\*\*Things this does not do\*\*/);
  });

  it('have a section for the milestone pop-ups, which need no deploy', () => {
    expect(doc).toMatch(/## Milestone level celebrations: every fifth level/);
    expect(doc).not.toMatch(/No level celebration yet/);
  });
});
