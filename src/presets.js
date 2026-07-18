// Plain-language presets so a first-time visitor gets a result with zero typing.
// Stages here carry only role + shape (agents/calls); token volume comes from
// the chosen "request size", and scale multiplies the fan-out. This keeps the
// simple view to 4 chips + 3 sliders while the engine stays exact.

// Request size -> tokens per call. cachedInTokens models cache reuse on the
// iterative implementation role.
export const REQUEST_SIZES = {
  짧음: { inTokens: 8000, outTokens: 500 },
  보통: { inTokens: 40000, outTokens: 2000 },
  김: { inTokens: 120000, outTokens: 6000 },
};

// Scale multiplies agents (fan-out) and calls (iterations).
export const SCALES = {
  소규모: 0.5,
  표준: 1,
  대규모: 2.5,
};

// Presets deliberately differ in role mix so the savings % visibly changes
// between them — that is the whole lesson ("절감폭은 구조마다 다르다").
export const PRESETS = [
  {
    id: "summarizer",
    name: "문서 요약 봇",
    emoji: "📄",
    blurb: "검색으로 자료 모아 요약. 탐색 팬아웃이 크다.",
    stages: [
      { role: "탐색", agents: 6, callsPerAgent: 1, cacheRatio: 0 },
      { role: "구현", agents: 1, callsPerAgent: 2, cacheRatio: 0.4 },
      { role: "검증", agents: 1, callsPerAgent: 1, cacheRatio: 0 },
    ],
  },
  {
    id: "code-review",
    name: "코드 리뷰",
    emoji: "🔍",
    blurb: "탐색 + 구현 + 다관점 검증. 균형형.",
    stages: [
      { role: "탐색", agents: 3, callsPerAgent: 2, cacheRatio: 0 },
      { role: "구현", agents: 1, callsPerAgent: 5, cacheRatio: 0.5 },
      { role: "검증", agents: 3, callsPerAgent: 1, cacheRatio: 0 },
    ],
  },
  {
    id: "deep-research",
    name: "딥리서치",
    emoji: "🧭",
    blurb: "대형 탐색 팬아웃 + 검증. 라우팅 이득 큼.",
    stages: [
      { role: "탐색", agents: 10, callsPerAgent: 2, cacheRatio: 0 },
      { role: "구현", agents: 1, callsPerAgent: 3, cacheRatio: 0.3 },
      { role: "검증", agents: 5, callsPerAgent: 1, cacheRatio: 0 },
    ],
  },
  {
    id: "content-gen",
    name: "콘텐츠 생성",
    emoji: "✍️",
    blurb: "구현(작성) 위주 + 검증. 라우팅 이득 작음.",
    stages: [
      { role: "탐색", agents: 2, callsPerAgent: 1, cacheRatio: 0 },
      { role: "구현", agents: 1, callsPerAgent: 8, cacheRatio: 0.5 },
      { role: "검증", agents: 2, callsPerAgent: 1, cacheRatio: 0 },
    ],
  },
];

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || PRESETS[0];
}

// Resolve a preset + size + scale into concrete engine stages.
export function resolveStages({ presetId, size = "보통", scale = "표준" }) {
  const preset = presetById(presetId);
  const tok = REQUEST_SIZES[size] || REQUEST_SIZES["보통"];
  const mult = SCALES[scale] ?? 1;
  return preset.stages.map((s) => {
    const agents = Math.max(1, Math.round(s.agents * mult));
    const calls = Math.max(1, Math.round(s.callsPerAgent * mult));
    return {
      role: s.role,
      agents,
      callsPerAgent: calls,
      inTokens: tok.inTokens,
      outTokens: tok.outTokens,
      cachedInTokens: Math.round(tok.inTokens * (s.cacheRatio || 0)),
    };
  });
}
