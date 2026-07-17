import { ROLES, TIERS, DEFAULT_ROLE_TIER, simulate } from "./cost-engine.js";
import { loadPricing, selectionToModels, defaultSelection } from "./pricing.js";
import { renderChart } from "./chart.js";
import { readStateFromUrl, writeStateToUrl } from "./state.js";

const TIER_LABEL = { S: "Small / fast", M: "Mid", F: "Frontier" };

const DEFAULT_STAGES = [
  { role: "탐색", agents: 4, callsPerAgent: 2, inTokens: 40000, outTokens: 1500, cachedInTokens: 0 },
  { role: "구현", agents: 1, callsPerAgent: 6, inTokens: 60000, outTokens: 4000, cachedInTokens: 20000 },
  { role: "검증", agents: 3, callsPerAgent: 1, inTokens: 45000, outTokens: 2000, cachedInTokens: 0 },
];

let pricing = null;
let state = null;

const $ = (sel) => document.querySelector(sel);

function money(n) {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(5)}`;
}
function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function stageRow(stage, i) {
  const roleOpts = ROLES.map(
    (r) => `<option value="${r}" ${r === stage.role ? "selected" : ""}>${r}</option>`
  ).join("");
  return `
  <div class="stage" data-i="${i}">
    <div class="field role">
      <label>역할</label>
      <select data-k="role">${roleOpts}</select>
    </div>
    <div class="field"><label>에이전트</label><input type="number" min="0" step="1" data-k="agents" value="${stage.agents}"></div>
    <div class="field"><label>호출/에이전트</label><input type="number" min="0" step="1" data-k="callsPerAgent" value="${stage.callsPerAgent}"></div>
    <div class="field"><label>입력 토큰</label><input type="number" min="0" step="1000" data-k="inTokens" value="${stage.inTokens}"></div>
    <div class="field"><label>출력 토큰</label><input type="number" min="0" step="500" data-k="outTokens" value="${stage.outTokens}"></div>
    <div class="field"><label title="입력 중 캐시 재사용분">캐시 입력</label><input type="number" min="0" step="1000" data-k="cachedInTokens" value="${stage.cachedInTokens || 0}"></div>
    <button class="btn btn-icon" data-act="del" title="단계 삭제" aria-label="단계 삭제">✕</button>
  </div>`;
}

function tierPicker() {
  return TIERS.map((tier) => {
    const opts = (pricing.byTier[tier] || [])
      .map((m) => `<option value="${m.id}" ${state.selection[tier] === m.id ? "selected" : ""}>${m.label || m.id}</option>`)
      .join("");
    return `
    <div class="field">
      <label>${TIER_LABEL[tier]} (${tier})</label>
      <select data-tier="${tier}">${opts || '<option value="">없음</option>'}</select>
    </div>`;
  }).join("");
}

function render() {
  $("#stages").innerHTML = state.stages.map(stageRow).join("");
  $("#tiers").innerHTML = tierPicker();

  const models = selectionToModels(pricing, state.selection);
  const result = simulate({ stages: state.stages, models, roleTier: DEFAULT_ROLE_TIER });

  const fig = $("#savings");
  fig.textContent = pct(result.savingsPct);
  fig.classList.toggle("neg", result.savingsPct < 0);

  $("#baseline-total").textContent = `${money(result.baseline.total)}/run`;
  $("#routed-total").textContent = `${money(result.routed.total)}/run`;
  $("#saved").textContent = `${money(result.savedCost)}/run`;

  renderChart($("#chart"), result);

  const d = result.dominantRoutedStage;
  const callout = $("#callout");
  if (d && d.share >= 0.5 && d.tier === "F") {
    callout.hidden = false;
    callout.innerHTML = `<strong>${d.role}</strong> 단계가 라우팅 후 비용의 <strong>${pct(d.share)}</strong>를 차지합니다. 프론티어(F) 티어라 라우팅 이득이 여기서 막혀요. 이 단계의 토큰/호출을 줄이거나 티어를 낮출 수 있는지 검토하세요.`;
  } else if (d && d.share >= 0.5) {
    callout.hidden = false;
    callout.innerHTML = `<strong>${d.role}</strong> 단계가 라우팅 비용의 <strong>${pct(d.share)}</strong>. 최적화 여력이 여기 집중돼 있습니다.`;
  } else {
    callout.hidden = true;
  }

  persist();
}

function persist() {
  writeStateToUrl({ stages: state.stages, selection: state.selection });
}

function bind() {
  $("#stages").addEventListener("input", (e) => {
    const row = e.target.closest(".stage");
    if (!row) return;
    const i = Number(row.dataset.i);
    const k = e.target.dataset.k;
    if (!k) return;
    const v = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    state.stages[i] = { ...state.stages[i], [k]: v };
    // number edits don't need full re-render of inputs; recompute only
    recompute();
  });

  $("#stages").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act=del]");
    if (!btn) return;
    const i = Number(btn.closest(".stage").dataset.i);
    state.stages.splice(i, 1);
    render();
  });

  $("#tiers").addEventListener("change", (e) => {
    const tier = e.target.dataset.tier;
    if (!tier) return;
    state.selection[tier] = e.target.value;
    recompute();
  });

  $("#add-stage").addEventListener("click", () => {
    state.stages.push({ role: "구현", agents: 1, callsPerAgent: 1, inTokens: 30000, outTokens: 2000, cachedInTokens: 0 });
    render();
  });

  $("#reset").addEventListener("click", () => {
    state = { stages: structuredClone(DEFAULT_STAGES), selection: defaultSelection(pricing) };
    render();
  });

  $("#share").addEventListener("click", async () => {
    const url = writeStateToUrl({ stages: state.stages, selection: state.selection });
    try {
      await navigator.clipboard.writeText(url);
      $("#share").textContent = "링크 복사됨";
      setTimeout(() => ($("#share").textContent = "공유 링크"), 1600);
    } catch {
      /* clipboard blocked; URL already in address bar */
    }
  });
}

// Recompute results without rebuilding input DOM (keeps focus while typing).
function recompute() {
  const models = selectionToModels(pricing, state.selection);
  const result = simulate({ stages: state.stages, models, roleTier: DEFAULT_ROLE_TIER });
  const fig = $("#savings");
  fig.textContent = pct(result.savingsPct);
  fig.classList.toggle("neg", result.savingsPct < 0);
  $("#baseline-total").textContent = `${money(result.baseline.total)}/run`;
  $("#routed-total").textContent = `${money(result.routed.total)}/run`;
  $("#saved").textContent = `${money(result.savedCost)}/run`;
  renderChart($("#chart"), result);
  const d = result.dominantRoutedStage;
  const callout = $("#callout");
  if (d && d.share >= 0.5) {
    callout.hidden = false;
    callout.innerHTML =
      d.tier === "F"
        ? `<strong>${d.role}</strong> 단계가 라우팅 후 비용의 <strong>${pct(d.share)}</strong> (프론티어 티어). 라우팅 이득이 여기서 막힙니다.`
        : `<strong>${d.role}</strong> 단계가 라우팅 비용의 <strong>${pct(d.share)}</strong>.`;
  } else {
    callout.hidden = true;
  }
  persist();
}

function meta() {
  const box = $("#meta");
  const stale = pricing.stale
    ? ` <span class="badge-stale">가격 stale</span>`
    : "";
  box.innerHTML = `가격표 갱신: <strong>${pricing.updatedAt || "unknown"}</strong>${stale}. 단위 = $/1M tokens. ${pricing.note || ""}`;
}

async function main() {
  try {
    pricing = await loadPricing();
  } catch (err) {
    document.querySelector("#chart").innerHTML =
      `<p class="callout" style="border-color:var(--tier-f)">가격표(data/pricing.json)를 불러오지 못했습니다: ${err.message}</p>`;
    return;
  }

  const restored = readStateFromUrl();
  state = {
    stages:
      Array.isArray(restored?.stages) && restored.stages.length
        ? restored.stages
        : structuredClone(DEFAULT_STAGES),
    selection: restored?.selection || defaultSelection(pricing),
  };
  // guard: ensure selection covers every tier
  for (const t of TIERS) {
    if (!state.selection[t]) state.selection[t] = defaultSelection(pricing)[t];
  }

  bind();
  render();
  meta();
}

main();
