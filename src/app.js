import { ROLES, TIERS, DEFAULT_ROLE_TIER, simulate } from "./cost-engine.js";
import { loadPricing, selectionToModels, defaultSelection } from "./pricing.js";
import { renderChart } from "./chart.js";
import { readStateFromUrl, writeStateToUrl } from "./state.js";
import { PRESETS, REQUEST_SIZES, SCALES, resolveStages } from "./presets.js";

const RUNS = [
  { v: 10, label: "하루 10회" },
  { v: 100, label: "하루 100회" },
  { v: 1000, label: "하루 1천회" },
  { v: 10000, label: "하루 1만회" },
];
const TIER_LABEL = { S: "저비용 (탐색)", M: "중간 (구현)", F: "프론티어 (검증)" };
const TIER_SHORT = { S: "저비용", M: "중간", F: "프론티어" };
const DAYS = 30;

let pricing = null;
let state = null;

const $ = (s) => document.querySelector(s);

function money(n) {
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  if (n >= 10) return `$${n.toFixed(0)}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(3)}`;
}
const pct = (n) => `${Math.round(n * 100)}%`;

function chips(name, options, current) {
  return options
    .map(
      (o) =>
        `<button class="chip ${o.v === current || o.key === current ? "on" : ""}" data-chip="${name}" data-val="${o.v ?? o.key}" type="button">${o.label}</button>`
    )
    .join("");
}

function currentStages() {
  if (state.mode === "advanced" && Array.isArray(state.customStages)) {
    return state.customStages;
  }
  return resolveStages({ presetId: state.presetId, size: state.size, scale: state.scale });
}

function scaleResult(r, f) {
  return {
    ...r,
    baseline: { total: r.baseline.total * f },
    routed: { total: r.routed.total * f },
    stages: r.stages.map((s) => ({ ...s, baselineCost: s.baselineCost * f, routedCost: s.routedCost * f })),
  };
}

function render() {
  // preset cards
  $("#presets").innerHTML = PRESETS.map(
    (p) => `
    <button class="preset ${p.id === state.presetId ? "on" : ""}" data-preset="${p.id}" type="button">
      <span class="preset-emoji">${p.emoji}</span>
      <span class="preset-name">${p.name}</span>
      <span class="preset-blurb">${p.blurb}</span>
    </button>`
  ).join("");

  $("#size-chips").innerHTML = chips(
    "size",
    Object.keys(REQUEST_SIZES).map((k) => ({ key: k, label: k, v: k })),
    state.size
  );
  $("#scale-chips").innerHTML = chips(
    "scale",
    Object.keys(SCALES).map((k) => ({ key: k, label: k, v: k })),
    state.scale
  );
  $("#runs-chips").innerHTML = chips("runs", RUNS, state.runsPerDay);

  compute();
  renderAdvanced();
}

function compute() {
  const stages = currentStages();
  const models = selectionToModels(pricing, state.selection);
  renderRatio(models);
  const perRun = simulate({ stages, models, roleTier: DEFAULT_ROLE_TIER });
  const factor = state.runsPerDay * DAYS;
  const monthly = scaleResult(perRun, factor);

  const fig = $("#savings");
  fig.textContent = pct(perRun.savingsPct);
  fig.classList.toggle("neg", perRun.savingsPct < 0);

  $("#takeaway").innerHTML =
    perRun.savingsPct > 0
      ? `역할별로 모델을 나누면 이 파이프라인의 월 비용이 <b>${money(monthly.baseline.total)}</b> → <b>${money(monthly.routed.total)}</b> 로 줄어요. <span class="muted">(하루 ${state.runsPerDay.toLocaleString()}회 기준)</span>`
      : `이 구조에선 라우팅 이득이 거의 없어요. 검증 단계가 비용을 지배합니다.`;

  $("#m-base").textContent = money(monthly.baseline.total);
  $("#m-routed").textContent = money(monthly.routed.total);
  $("#m-saved").textContent = money(monthly.baseline.total - monthly.routed.total);

  renderRouteStrip(stages, models);
  renderChart($("#chart"), monthly);

  const d = perRun.dominantRoutedStage;
  const callout = $("#callout");
  if (d && d.share >= 0.5 && d.tier === "F") {
    callout.hidden = false;
    callout.innerHTML = `💡 <b>${d.role}</b> 단계가 라우팅 후 비용의 <b>${pct(d.share)}</b>. 프론티어 티어라 여기서 이득이 막혀요 — 이 단계 호출을 줄이면 더 절감됩니다.`;
  } else {
    callout.hidden = true;
  }

  persist();
}

// Price gap between frontier and cheap tier — grounds the "why".
function renderRatio(models) {
  const el = $("#ratio");
  if (!el) return;
  const f = models.F?.in;
  const s = models.S?.in;
  if (f && s && s > 0) {
    const r = Math.round(f / s);
    el.textContent = `프론티어는 저비용 티어보다 토큰당 약 ${r}배 비싸요.`;
  } else {
    el.textContent = "";
  }
}

// Make routing literal: show each stage as a pill coloured by its routed tier.
function renderRouteStrip(stages, _models) {
  const strip = $("#route-strip");
  if (!strip) return;
  strip.replaceChildren();
  stages.forEach((s, i) => {
    if (i > 0) {
      const arrow = document.createElement("span");
      arrow.className = "route-arrow";
      arrow.textContent = "→";
      strip.appendChild(arrow);
    }
    const tier = DEFAULT_ROLE_TIER[s.role] ?? "M";
    const calls = s.agents * s.callsPerAgent;
    const pill = document.createElement("span");
    pill.className = `route-pill tier-${tier}`;
    pill.innerHTML = `<span class="rp-role">${s.role}</span><span class="rp-meta">×${calls} · ${TIER_SHORT[tier]}</span>`;
    strip.appendChild(pill);
  });
}

// ---- Advanced (collapsed) --------------------------------------------------

function stageRow(stage, i) {
  const roleOpts = ROLES.map((r) => `<option value="${r}" ${r === stage.role ? "selected" : ""}>${r}</option>`).join("");
  return `
  <div class="stage" data-i="${i}">
    <div class="field role"><label>역할</label><select data-k="role">${roleOpts}</select></div>
    <div class="field"><label>에이전트</label><input type="number" min="0" data-k="agents" value="${stage.agents}"></div>
    <div class="field"><label>호출/에이전트</label><input type="number" min="0" data-k="callsPerAgent" value="${stage.callsPerAgent}"></div>
    <div class="field"><label>입력 토큰</label><input type="number" min="0" step="1000" data-k="inTokens" value="${stage.inTokens}"></div>
    <div class="field"><label>출력 토큰</label><input type="number" min="0" step="500" data-k="outTokens" value="${stage.outTokens}"></div>
    <div class="field"><label>캐시 입력</label><input type="number" min="0" step="1000" data-k="cachedInTokens" value="${stage.cachedInTokens || 0}"></div>
    <button class="btn btn-icon" data-act="del" aria-label="삭제">✕</button>
  </div>`;
}

function renderAdvanced() {
  $("#stages").innerHTML = currentStages().map(stageRow).join("");
  $("#tiers").innerHTML = TIERS.map((tier) => {
    const opts = (pricing.byTier[tier] || [])
      .map((m) => `<option value="${m.id}" ${state.selection[tier] === m.id ? "selected" : ""}>${m.label || m.id}</option>`)
      .join("");
    return `<div class="field"><label>${TIER_LABEL[tier]}</label><select data-tier="${tier}">${opts}</select></div>`;
  }).join("");
}

function enterAdvanced() {
  if (state.mode !== "advanced") {
    state.mode = "advanced";
    state.customStages = currentStages();
  }
}

// ---- Events ----------------------------------------------------------------

function bind() {
  $("#presets").addEventListener("click", (e) => {
    const b = e.target.closest("[data-preset]");
    if (!b) return;
    state.presetId = b.dataset.preset;
    state.mode = "simple";
    state.customStages = null;
    render();
  });

  document.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-chip]");
    if (!chip) return;
    const kind = chip.dataset.chip;
    const val = chip.dataset.val;
    if (kind === "runs") state.runsPerDay = Number(val);
    else if (kind === "size") { state.size = val; state.mode = "simple"; state.customStages = null; }
    else if (kind === "scale") { state.scale = val; state.mode = "simple"; state.customStages = null; }
    render();
  });

  $("#stages").addEventListener("input", (e) => {
    const row = e.target.closest(".stage");
    const k = e.target.dataset.k;
    if (!row || !k) return;
    enterAdvanced();
    const i = Number(row.dataset.i);
    const v = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    state.customStages[i] = { ...state.customStages[i], [k]: v };
    compute();
  });

  $("#stages").addEventListener("click", (e) => {
    if (!e.target.closest("[data-act=del]")) return;
    enterAdvanced();
    const i = Number(e.target.closest(".stage").dataset.i);
    state.customStages.splice(i, 1);
    render();
  });

  $("#tiers").addEventListener("change", (e) => {
    const tier = e.target.dataset.tier;
    if (!tier) return;
    state.selection[tier] = e.target.value;
    compute();
  });

  $("#add-stage").addEventListener("click", () => {
    enterAdvanced();
    state.customStages.push({ role: "구현", agents: 1, callsPerAgent: 1, inTokens: 30000, outTokens: 2000, cachedInTokens: 0 });
    render();
  });

  $("#reset-preset").addEventListener("click", () => {
    state.mode = "simple";
    state.customStages = null;
    render();
  });

  $("#share").addEventListener("click", async () => {
    const url = persist();
    try {
      await navigator.clipboard.writeText(url);
      const b = $("#share");
      b.textContent = "링크 복사됨 ✓";
      setTimeout(() => (b.textContent = "결과 공유"), 1600);
    } catch { /* URL is already in the address bar */ }
  });
}

function persist() {
  return writeStateToUrl({
    mode: state.mode,
    presetId: state.presetId,
    size: state.size,
    scale: state.scale,
    runsPerDay: state.runsPerDay,
    selection: state.selection,
    customStages: state.mode === "advanced" ? state.customStages : null,
  });
}

function meta() {
  const stale = pricing.stale ? ` <span class="badge-stale">가격 stale</span>` : "";
  $("#meta").innerHTML = `단가 기준일 <b>${pricing.updatedAt || "?"}</b>${stale} · $/1M tokens · 공개 정가 기반 추정`;
}

async function main() {
  try {
    pricing = await loadPricing();
  } catch (err) {
    $("#chart").innerHTML = `<p class="callout">가격표를 불러오지 못했습니다: ${err.message}</p>`;
    return;
  }

  const r = readStateFromUrl();
  state = {
    mode: r?.mode === "advanced" ? "advanced" : "simple",
    presetId: r?.presetId || PRESETS[0].id,
    size: r?.size && REQUEST_SIZES[r.size] ? r.size : "보통",
    scale: r?.scale && SCALES[r.scale] ? r.scale : "표준",
    runsPerDay: RUNS.some((x) => x.v === r?.runsPerDay) ? r.runsPerDay : 100,
    selection: r?.selection || defaultSelection(pricing),
    customStages: Array.isArray(r?.customStages) ? r.customStages : null,
  };
  for (const t of TIERS) if (!state.selection[t]) state.selection[t] = defaultSelection(pricing)[t];

  bind();
  render();
  meta();
}

main();
