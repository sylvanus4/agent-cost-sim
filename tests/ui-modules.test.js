import test from "node:test";
import assert from "node:assert/strict";

import { normalizePricing, selectionToModels, defaultSelection } from "../src/pricing.js";
import { encodeState, decodeState } from "../src/state.js";

const RAW = {
  updated_at: "2026-07-18",
  stale: false,
  models: [
    { id: "a/f", tier: "F", in: 15, out: 75, cache_read: 1.5 },
    { id: "a/m", tier: "M", in: 3, out: 15, cache_read: 0.3 },
    { id: "a/s", tier: "S", in: 0.8, out: 4, cache_read: 0.08 },
    { id: "b/f", tier: "F", in: 10, out: 40, cache_read: 1.25 },
  ],
};

test("normalizePricing groups by tier", () => {
  const p = normalizePricing(RAW);
  assert.equal(p.byTier.F.length, 2);
  assert.equal(p.byTier.M.length, 1);
  assert.equal(p.byTier.S.length, 1);
  assert.equal(p.stale, false);
});

test("defaultSelection picks first model per tier", () => {
  const p = normalizePricing(RAW);
  const sel = defaultSelection(p);
  assert.deepEqual(sel, { S: "a/s", M: "a/m", F: "a/f" });
});

test("selectionToModels resolves ids, falls back to first-of-tier", () => {
  const p = normalizePricing(RAW);
  const models = selectionToModels(p, { F: "b/f", M: "nope", S: "a/s" });
  assert.equal(models.F.id, "b/f");
  assert.equal(models.M.id, "a/m"); // fallback
  assert.equal(models.S.id, "a/s");
});

test("state encode/decode round-trips unicode", () => {
  const state = {
    stages: [{ role: "탐색", agents: 4, callsPerAgent: 2, inTokens: 40000, outTokens: 1500 }],
    selection: { S: "a/s", M: "a/m", F: "a/f" },
  };
  const token = encodeState(state);
  assert.match(token, /^[A-Za-z0-9_-]+$/); // base64url, no padding
  assert.deepEqual(decodeState(token), state);
});

test("decodeState returns null on garbage", () => {
  assert.equal(decodeState("!!!not-valid!!!"), null);
  assert.equal(decodeState(""), null);
  assert.equal(decodeState(null), null);
});

// Minimal DOM stub so chart.js runs headless.
function stubNode() {
  return {
    children: [],
    attrs: {},
    _text: "",
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(c) { this.children.push(c); return c; },
    replaceChildren() { this.children = []; },
    set textContent(v) { this._text = v; },
    get textContent() { return this._text; },
  };
}

test("chart.js renderChart builds an SVG without throwing", async () => {
  globalThis.document = {
    createElementNS: () => stubNode(),
  };
  const { renderChart } = await import("../src/chart.js");
  const { simulate } = await import("../src/cost-engine.js");
  const models = {
    F: { id: "f", tier: "F", in: 15, out: 75, cache_read: 1.5 },
    M: { id: "m", tier: "M", in: 3, out: 15, cache_read: 0.3 },
    S: { id: "s", tier: "S", in: 0.8, out: 4, cache_read: 0.08 },
  };
  const result = simulate({
    stages: [
      { role: "탐색", agents: 4, callsPerAgent: 2, inTokens: 40000, outTokens: 1500 },
      { role: "검증", agents: 3, callsPerAgent: 1, inTokens: 45000, outTokens: 2000 },
    ],
    models,
  });
  const mount = stubNode();
  renderChart(mount, result);
  // one <svg> appended to mount
  assert.equal(mount.children.length, 1);
  const svg = mount.children[0];
  // svg should contain row labels, tracks, segments, totals
  assert.ok(svg.children.length > 4);
  delete globalThis.document;
});
