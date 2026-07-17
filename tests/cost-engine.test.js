import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ROLE_TIER,
  callCost,
  stageCost,
  simulate,
} from "../src/cost-engine.js";

// Three synthetic models, one per tier. Prices are per-million-token.
const MODELS = {
  F: { id: "frontier", tier: "F", in: 15, out: 75, cache_read: 1.5 },
  M: { id: "mid", tier: "M", in: 3, out: 15, cache_read: 0.3 },
  S: { id: "small", tier: "S", in: 0.8, out: 4, cache_read: 0.08 },
};

test("callCost: input+output priced per million tokens", () => {
  // 1M input @15 + 1M output @75 = 90
  assert.equal(callCost(MODELS.F, { inTokens: 1_000_000, outTokens: 1_000_000 }), 90);
});

test("callCost: cached input uses cache_read price, discounts fresh input", () => {
  // 1M total input of which 0.5M cached: 0.5M*15 + 0.5M*1.5 + 0 out
  const c = callCost(MODELS.F, {
    inTokens: 1_000_000,
    outTokens: 0,
    cachedInTokens: 500_000,
  });
  assert.equal(c, 0.5 * 15 + 0.5 * 1.5);
});

test("callCost: cached cannot exceed input (clamped)", () => {
  const c = callCost(MODELS.M, {
    inTokens: 100_000,
    outTokens: 0,
    cachedInTokens: 999_999_999,
  });
  // all 100k treated as cached, 0 fresh
  assert.equal(c, 0.1 * 0.3);
});

test("stageCost: multiplies by agents and calls_per_agent", () => {
  const stage = { agents: 3, callsPerAgent: 4, inTokens: 1_000_000, outTokens: 0 };
  // 12 calls * (1M*15) = 12*15 = 180
  assert.equal(stageCost(MODELS.F, stage), 180);
});

test("simulate: baseline routes every stage to frontier", () => {
  const stages = [
    { role: "탐색", agents: 1, callsPerAgent: 1, inTokens: 1_000_000, outTokens: 0 },
  ];
  const r = simulate({ stages, models: MODELS });
  assert.equal(r.baseline.total, 15);
});

test("simulate: routed uses default role->tier mapping", () => {
  assert.equal(DEFAULT_ROLE_TIER["탐색"], "S");
  assert.equal(DEFAULT_ROLE_TIER["구현"], "M");
  assert.equal(DEFAULT_ROLE_TIER["검증"], "F");

  const stages = [
    { role: "탐색", agents: 1, callsPerAgent: 1, inTokens: 1_000_000, outTokens: 0 },
  ];
  const r = simulate({ stages, models: MODELS });
  // routed exploration -> S: 1M*0.8 = 0.8
  assert.equal(r.routed.total, 0.8);
});

test("simulate: savings pct computed and never negative-baseline divide", () => {
  const stages = [
    { role: "탐색", agents: 2, callsPerAgent: 3, inTokens: 500_000, outTokens: 200_000 },
    { role: "구현", agents: 1, callsPerAgent: 5, inTokens: 1_000_000, outTokens: 800_000 },
    { role: "검증", agents: 3, callsPerAgent: 1, inTokens: 800_000, outTokens: 300_000 },
  ];
  const r = simulate({ stages, models: MODELS });
  assert.ok(r.baseline.total > r.routed.total, "routing should not cost more here");
  const expected = (r.baseline.total - r.routed.total) / r.baseline.total;
  assert.ok(Math.abs(r.savingsPct - expected) < 1e-9);
  assert.ok(r.savingsPct > 0 && r.savingsPct < 1);
});

test("simulate: zero stages -> zero cost, zero savings, no NaN", () => {
  const r = simulate({ stages: [], models: MODELS });
  assert.equal(r.baseline.total, 0);
  assert.equal(r.routed.total, 0);
  assert.equal(r.savingsPct, 0);
});

test("simulate: per-stage breakdown sums to totals", () => {
  const stages = [
    { role: "탐색", agents: 2, callsPerAgent: 2, inTokens: 400_000, outTokens: 100_000 },
    { role: "검증", agents: 1, callsPerAgent: 1, inTokens: 900_000, outTokens: 500_000 },
  ];
  const r = simulate({ stages, models: MODELS });
  const sumBase = r.stages.reduce((a, s) => a + s.baselineCost, 0);
  const sumRouted = r.stages.reduce((a, s) => a + s.routedCost, 0);
  assert.ok(Math.abs(sumBase - r.baseline.total) < 1e-9);
  assert.ok(Math.abs(sumRouted - r.routed.total) < 1e-9);
});

test("simulate: dominant stage flagged when it drives >=50% routed cost", () => {
  const stages = [
    { role: "탐색", agents: 1, callsPerAgent: 1, inTokens: 10_000, outTokens: 0 },
    { role: "검증", agents: 5, callsPerAgent: 5, inTokens: 2_000_000, outTokens: 1_000_000 },
  ];
  const r = simulate({ stages, models: MODELS });
  assert.equal(r.dominantRoutedStage.role, "검증");
  assert.ok(r.dominantRoutedStage.share >= 0.5);
});

test("simulate: custom role->tier override respected", () => {
  const stages = [
    { role: "검증", agents: 1, callsPerAgent: 1, inTokens: 1_000_000, outTokens: 0 },
  ];
  // Force verification onto mid tier instead of frontier
  const r = simulate({ stages, models: MODELS, roleTier: { 검증: "M" } });
  assert.equal(r.routed.total, 3); // 1M * 3
});
