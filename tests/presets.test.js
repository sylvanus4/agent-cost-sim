import test from "node:test";
import assert from "node:assert/strict";

import { PRESETS, REQUEST_SIZES, SCALES, resolveStages, presetById } from "../src/presets.js";
import { simulate } from "../src/cost-engine.js";

const MODELS = {
  F: { id: "f", tier: "F", in: 15, out: 75, cache_read: 1.5 },
  M: { id: "m", tier: "M", in: 3, out: 15, cache_read: 0.3 },
  S: { id: "s", tier: "S", in: 0.8, out: 4, cache_read: 0.08 },
};

test("every preset resolves to valid, non-empty stages", () => {
  for (const p of PRESETS) {
    const stages = resolveStages({ presetId: p.id, size: "보통", scale: "표준" });
    assert.ok(stages.length > 0, `${p.id} has stages`);
    for (const s of stages) {
      assert.ok(["탐색", "구현", "검증"].includes(s.role));
      assert.ok(s.agents >= 1 && s.callsPerAgent >= 1);
      assert.ok(s.inTokens > 0);
      assert.ok(s.cachedInTokens <= s.inTokens);
    }
  }
});

test("scale multiplies fan-out; larger scale costs more", () => {
  const small = resolveStages({ presetId: "deep-research", size: "보통", scale: "소규모" });
  const large = resolveStages({ presetId: "deep-research", size: "보통", scale: "대규모" });
  const cs = simulate({ stages: small, models: MODELS }).routed.total;
  const cl = simulate({ stages: large, models: MODELS }).routed.total;
  assert.ok(cl > cs);
});

test("request size scales tokens; bigger size costs more", () => {
  const a = resolveStages({ presetId: "code-review", size: "짧음", scale: "표준" });
  const b = resolveStages({ presetId: "code-review", size: "김", scale: "표준" });
  assert.ok(REQUEST_SIZES["김"].inTokens > REQUEST_SIZES["짧음"].inTokens);
  const ca = simulate({ stages: a, models: MODELS }).baseline.total;
  const cb = simulate({ stages: b, models: MODELS }).baseline.total;
  assert.ok(cb > ca);
});

test("presets differ in savings pct (the lesson: structure matters)", () => {
  const savings = PRESETS.map((p) => {
    const stages = resolveStages({ presetId: p.id, size: "보통", scale: "표준" });
    return simulate({ stages, models: MODELS }).savingsPct;
  });
  // exploration-heavy deep-research should save more than content-gen (impl-heavy)
  const deep = savings[PRESETS.findIndex((p) => p.id === "deep-research")];
  const content = savings[PRESETS.findIndex((p) => p.id === "content-gen")];
  assert.ok(deep > content, `deep(${deep}) should beat content(${content})`);
  // all presets produce positive savings with the default mapping
  assert.ok(savings.every((s) => s > 0));
});

test("presetById falls back to first preset on unknown id", () => {
  assert.equal(presetById("nope").id, PRESETS[0].id);
  assert.equal(Object.keys(SCALES).length, 3);
});
