// Dependency-free SVG bar chart. Two horizontal stacked bars (Baseline vs
// Routed), stacked by pipeline stage. Theme colours come from CSS variables
// so light/dark stay in sync with the page.

const NS = "http://www.w3.org/2000/svg";

// Tier -> CSS variable (defined in tokens.css). Baseline is always frontier.
const TIER_VAR = { F: "--tier-f", M: "--tier-m", S: "--tier-s" };

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function money(n) {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(5)}`;
}

// result: output of simulate(). Renders into `mount` (an SVG-less container).
export function renderChart(mount, result) {
  mount.replaceChildren();
  const max = Math.max(result.baseline.total, result.routed.total, 1e-9);

  const W = 720;
  const rowH = 64;
  const gap = 28;
  const padL = 96;
  const padR = 120;
  const trackW = W - padL - padR;
  const H = rowH * 2 + gap + 24;

  const svg = el("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": `Baseline ${money(result.baseline.total)} versus routed ${money(
      result.routed.total
    )} per run`,
    class: "cost-chart",
  });

  const rows = [
    { label: "Baseline", total: result.baseline.total, key: "baselineCost", baseline: true },
    { label: "Routed", total: result.routed.total, key: "routedCost", baseline: false },
  ];

  rows.forEach((row, i) => {
    const y = 8 + i * (rowH + gap);

    const label = el("text", { x: padL - 12, y: y + rowH / 2, class: "chart-row-label", "text-anchor": "end", "dominant-baseline": "middle" });
    label.textContent = row.label;
    svg.appendChild(label);

    // track background
    svg.appendChild(el("rect", { x: padL, y, width: trackW, height: rowH, rx: 10, class: "chart-track" }));

    // stacked segments
    let cursor = padL;
    result.stages.forEach((s) => {
      const val = s[row.key];
      if (val <= 0) return;
      const w = (val / max) * trackW;
      const fillVar = row.baseline ? TIER_VAR.F : TIER_VAR[s.tier] || TIER_VAR.M;
      const seg = el("rect", {
        x: cursor,
        y,
        width: Math.max(w, 0),
        height: rowH,
        rx: 4,
        fill: `var(${fillVar})`,
        class: "chart-seg",
      });
      const title = el("title");
      title.textContent = `${s.role} (${row.baseline ? "F" : s.tier}): ${money(val)}`;
      seg.appendChild(title);
      svg.appendChild(seg);
      cursor += w;
    });

    // total label at end of bar
    const totalW = (row.total / max) * trackW;
    const t = el("text", {
      x: padL + totalW + 12,
      y: y + rowH / 2,
      class: "chart-total",
      "dominant-baseline": "middle",
    });
    t.textContent = money(row.total);
    svg.appendChild(t);
  });

  mount.appendChild(svg);
}
