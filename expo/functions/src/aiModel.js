// Which OpenAI model writes a person's answer. Pro and Legend get the larger model; Free gets the smaller one, which costs roughly a
// fifteenth as much for the same message and is what keeps a free account from costing more than it can ever bring in.
//
// Only the model that WRITES the answer changes. The topic check in front of it (scope.js, GATE_MODEL) is the small model on every
// plan, and the scope rule goes in front of the answer on every plan, so what the AI will and will not talk about is the same for all.
// PAID_MODEL is the model the safety set tests as its main model (functions/safety/check.js); the Free model is tested by running the
// set with --model=gpt-4o-mini (docs/SAFETY_TESTS.md).
import { tierAtLeast } from './entitlements.js';

export const PAID_MODEL = 'gpt-4o';
export const FREE_MODEL = 'gpt-4o-mini';

/** The model for a plan. A plan that is not known counts as Free, the cheaper one. */
export const aiModelFor = (tier) => (tierAtLeast(tier, 'pro') ? PAID_MODEL : FREE_MODEL);
