// Deterministic cost engine for multi-agent pipeline routing.
// Vendor-neutral: prices come from the caller (data/pricing.json).
// All prices are USD per one million tokens.

const PER_MILLION = 1_000_000;

// Default role -> tier mapping. Mirrors the common routing heuristic:
// exploration on the small/fast tier, implementation on mid, verification
// (judgement/architecture) on the frontier tier. Fully overridable.
export const DEFAULT_ROLE_TIER = Object.freeze({
  탐색: "S",
  구현: "M",
  검증: "F",
});

export const ROLES = Object.freeze(["탐색", "구현", "검증"]);
export const TIERS = Object.freeze(["S", "M", "F"]);

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Cost of a single model call. cachedInTokens is a subset of inTokens billed
// at the cheaper cache_read price; the remainder is billed at the input price.
export function callCost(model, { inTokens = 0, outTokens = 0, cachedInTokens = 0 } = {}) {
  const inTok = num(inTokens);
  const outTok = num(outTokens);
  const cached = Math.min(num(cachedInTokens), inTok);
  const fresh = inTok - cached;

  const priceIn = num(model?.in);
  const priceOut = num(model?.out);
  const priceCache = num(model?.cache_read, priceIn); // fall back to input price

  return (
    (fresh * priceIn + cached * priceCache + outTok * priceOut) / PER_MILLION
  );
}

// Cost of one pipeline stage under a given model.
export function stageCost(model, stage) {
  const agents = num(stage?.agents, 1);
  const calls = num(stage?.callsPerAgent, 1);
  const perCall = callCost(model, {
    inTokens: stage?.inTokens,
    outTokens: stage?.outTokens,
    cachedInTokens: stage?.cachedInTokens,
  });
  return agents * calls * perCall;
}

// Pick the model object for a tier. models may be keyed by tier (test helper)
// or provided as an array with a `tier` field (pricing.json shape).
function modelForTier(models, tier) {
  if (!models) return null;
  if (Array.isArray(models)) {
    return models.find((m) => m.tier === tier) ?? null;
  }
  return models[tier] ?? null;
}

// Run the two scenarios and return a full comparison.
//   baseline: every stage on the frontier tier (F)
//   routed:   every stage on its role's tier (roleTier mapping)
export function simulate({ stages = [], models, roleTier = DEFAULT_ROLE_TIER } = {}) {
  const frontier = modelForTier(models, "F");

  const perStage = stages.map((stage, index) => {
    const tier = roleTier[stage.role] ?? "M";
    const routedModel = modelForTier(models, tier);

    const baselineCost = frontier ? stageCost(frontier, stage) : 0;
    const routedCost = routedModel ? stageCost(routedModel, stage) : 0;

    return {
      index,
      role: stage.role,
      tier,
      baselineCost,
      routedCost,
      savedCost: baselineCost - routedCost,
    };
  });

  const baselineTotal = perStage.reduce((a, s) => a + s.baselineCost, 0);
  const routedTotal = perStage.reduce((a, s) => a + s.routedCost, 0);

  const savingsPct = baselineTotal > 0 ? (baselineTotal - routedTotal) / baselineTotal : 0;

  // Which stage drives the routed cost (surfaces "routing stopped helping").
  let dominantRoutedStage = null;
  if (routedTotal > 0) {
    const top = perStage.reduce((a, b) => (b.routedCost > a.routedCost ? b : a));
    dominantRoutedStage = {
      index: top.index,
      role: top.role,
      tier: top.tier,
      share: top.routedCost / routedTotal,
    };
  }

  return {
    stages: perStage,
    baseline: { total: baselineTotal },
    routed: { total: routedTotal },
    savedCost: baselineTotal - routedTotal,
    savingsPct,
    dominantRoutedStage,
  };
}
