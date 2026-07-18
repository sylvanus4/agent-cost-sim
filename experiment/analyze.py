#!/usr/bin/env python3
"""Aggregate the A/B experiment: real token cost vs measured code quality.

Reads:
  measure.jsonl   one row per (task, variant, stage): model, tier, tokens
  runs/*__final.py  the post-verify code for each (task, variant)

Quality  = check.py pass rate on hidden tests (objective).
Cost     = Σ stage_tokens × blended tier price.

Token counts are REAL (reported by the agent harness per subagent). Tier prices
are representative public list prices per 1M tokens; because subagent totals are
not split into input/output, we apply a stated blended rate. The savings % is
dominated by the price ratio between tiers and is robust to the exact blend.
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
TASKS = ["merge_intervals", "parse_semver", "word_frequency"]
VARIANTS = ["baseline", "routed"]

# Representative public list prices, USD per 1M tokens (input, output).
TIER_PRICE = {
    "F": {"in": 15.0, "out": 75.0},   # frontier / opus-class
    "M": {"in": 3.0, "out": 15.0},    # mid / sonnet-class
    "S": {"in": 0.8, "out": 4.0},     # small / haiku-class
}
# Blend for total-token pricing (subagent totals aren't split in/out).
IN_W, OUT_W = 0.75, 0.25


def blended(tier: str) -> float:
    p = TIER_PRICE[tier]
    return IN_W * p["in"] + OUT_W * p["out"]


def load_measures():
    rows = []
    with (HERE / "measure.jsonl").open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def quality(task: str, variant: str) -> dict:
    path = HERE / "runs" / f"{task}__{variant}__final.py"
    if not path.exists():
        return {"passed": 0, "total": 0, "missing": True}
    out = subprocess.run(
        [sys.executable, str(HERE / "check.py"), task, str(path)],
        capture_output=True, text=True,
    )
    try:
        return json.loads(out.stdout.strip())
    except Exception:
        return {"passed": 0, "total": 0, "error": out.stderr[:200]}


def main() -> int:
    rows = load_measures()
    results = {"tasks": [], "aggregate": {}, "assumptions": {
        "tier_price_per_mtok": TIER_PRICE, "blend_input_weight": IN_W, "blend_output_weight": OUT_W,
    }}

    agg = {v: {"tokens": 0, "cost": 0.0, "passed": 0, "total": 0} for v in VARIANTS}

    for task in TASKS:
        entry = {"task": task, "variants": {}}
        for variant in VARIANTS:
            stages = [r for r in rows if r["task"] == task and r["variant"] == variant]
            tokens = sum(r["tokens"] for r in stages)
            cost = sum(r["tokens"] / 1e6 * blended(r["tier"]) for r in stages)
            q = quality(task, variant)
            entry["variants"][variant] = {
                "tokens": tokens,
                "cost_usd": round(cost, 4),
                "passed": q.get("passed", 0),
                "total": q.get("total", 0),
                "stages": [{"stage": r["stage"], "tier": r["tier"], "model": r["model"], "tokens": r["tokens"]} for r in stages],
            }
            agg[variant]["tokens"] += tokens
            agg[variant]["cost"] += cost
            agg[variant]["passed"] += q.get("passed", 0)
            agg[variant]["total"] += q.get("total", 0)
        results["tasks"].append(entry)

    base_c, routed_c = agg["baseline"]["cost"], agg["routed"]["cost"]
    results["aggregate"] = {
        "baseline": {"tokens": agg["baseline"]["tokens"], "cost_usd": round(base_c, 4),
                     "quality_pct": round(100 * agg["baseline"]["passed"] / max(agg["baseline"]["total"], 1), 1)},
        "routed": {"tokens": agg["routed"]["tokens"], "cost_usd": round(routed_c, 4),
                   "quality_pct": round(100 * agg["routed"]["passed"] / max(agg["routed"]["total"], 1), 1)},
        "cost_savings_pct": round(100 * (base_c - routed_c) / base_c, 1) if base_c else 0,
    }
    results["aggregate"]["quality_delta_pct"] = round(
        results["aggregate"]["routed"]["quality_pct"] - results["aggregate"]["baseline"]["quality_pct"], 1
    )

    (HERE.parent / "data" / "experiment-results.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    a = results["aggregate"]
    print(f"{'':14} {'quality':>9} {'tokens':>12} {'cost(USD)':>11}")
    for v in VARIANTS:
        av = a[v]
        print(f"{v:14} {av['quality_pct']:>8}% {av['tokens']:>12,} {av['cost_usd']:>11.4f}")
    print(f"\ncost savings: {a['cost_savings_pct']}%   quality delta: {a['quality_delta_pct']:+} pts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
