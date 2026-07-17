// Loads data/pricing.json and exposes tier -> model selection.
// Runtime makes no external calls; it only fetches the committed file.

import { TIERS } from "./cost-engine.js";

const PRICING_URL = new URL("../data/pricing.json", import.meta.url);

export async function loadPricing() {
  const res = await fetch(PRICING_URL);
  if (!res.ok) throw new Error(`pricing.json ${res.status}`);
  const data = await res.json();
  return normalizePricing(data);
}

export function normalizePricing(data) {
  const models = Array.isArray(data?.models) ? data.models : [];
  const byTier = Object.fromEntries(
    TIERS.map((t) => [t, models.filter((m) => m.tier === t)])
  );
  return {
    updatedAt: data?.updated_at ?? null,
    stale: Boolean(data?.stale),
    note: data?.note ?? "",
    models,
    byTier,
  };
}

// Given a selection { S: modelId, M: modelId, F: modelId }, return a
// tier -> model object map the cost engine understands.
export function selectionToModels(pricing, selection) {
  const out = {};
  for (const tier of TIERS) {
    const id = selection?.[tier];
    out[tier] =
      pricing.models.find((m) => m.id === id) ??
      pricing.byTier[tier]?.[0] ??
      null;
  }
  return out;
}

// Default selection: first model of each tier.
export function defaultSelection(pricing) {
  const sel = {};
  for (const tier of TIERS) {
    sel[tier] = pricing.byTier[tier]?.[0]?.id ?? null;
  }
  return sel;
}
