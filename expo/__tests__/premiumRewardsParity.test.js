// The Premium rewards are used by the app (lib/premiumRewards.js) and by the Cloud Function that hands them out (functions/src/premiumRewards.js).
// A deployed function cannot import from the app, so the function has a copy. They have to be the same file, or the phone would list a reward the
// server does not give, or the server would give one the phone does not show.
const fs = require('fs');
const path = require('path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

describe('the Premium rewards in the app and in the functions', () => {
  it('are the same file', () => {
    expect(read('functions/src/premiumRewards.js')).toBe(read('lib/premiumRewards.js'));
  });

  it('use nothing from outside themselves, so the copy can run on its own', () => {
    expect(read('lib/premiumRewards.js')).not.toMatch(/^\s*import\s/m);
    expect(read('lib/premiumRewards.js')).not.toMatch(/\brequire\(/);
  });

  it('give the same answers when loaded from both places', () => {
    const app = require('../lib/premiumRewards');
    const server = require('../functions/src/premiumRewards');
    expect(Object.keys(server).sort()).toEqual(Object.keys(app).sort());
    expect(server.PREMIUM_REWARDS).toEqual(app.PREMIUM_REWARDS);
    expect(server.premiumBenefits()).toEqual(app.premiumBenefits());
    const now = new Date('2026-11-23T12:00:00.000Z');
    const pass = { active: true, expiresAt: '2026-12-01T00:00:00.000Z' };
    expect(server.premiumPassActive(pass, now)).toBe(app.premiumPassActive(pass, now));
  });
});
