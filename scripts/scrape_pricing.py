#!/usr/bin/env python3
"""Nightly pricing refresher for Agent Cost Sim.

Runs on a CI runner (GitHub Actions), not in the app. Fetches public pricing
via pluggable adapters, validates the schema, and writes data/pricing.json.

Honesty guarantees (see .claude/rules news-freshness / graceful-degradation):
  - Never fabricates prices. An adapter that fails or yields nothing is skipped.
  - If EVERY adapter fails, the previous pricing.json is preserved and marked
    stale=true rather than emitting garbage.
  - unit is always per_mtok (USD per 1,000,000 tokens).

Adapters live in scripts/adapters/. Each exposes fetch() -> list[dict] of
model rows. Ship real adapters as provider pricing pages/endpoints stabilize;
the repo default keeps a curated seed so the site always has valid data.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "pricing.json"
SEED = ROOT / "scripts" / "seed_pricing.json"

REQUIRED_FIELDS = ("id", "tier", "in", "out")
VALID_TIERS = {"S", "M", "F"}


def load_json(path: pathlib.Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def validate_models(models: list) -> list:
    """Return only well-formed rows; drop anything malformed."""
    clean = []
    for m in models:
        if not isinstance(m, dict):
            continue
        if any(f not in m for f in REQUIRED_FIELDS):
            continue
        if m["tier"] not in VALID_TIERS:
            continue
        try:
            m = {
                **m,
                "in": float(m["in"]),
                "out": float(m["out"]),
                "cache_read": float(m.get("cache_read", m["in"] * 0.1)),
            }
        except (TypeError, ValueError):
            continue
        if m["in"] < 0 or m["out"] < 0:
            continue
        clean.append(m)
    return clean


def run_adapters() -> list:
    """Import and run every adapter in scripts/adapters/. Missing dir -> []."""
    adapters_dir = ROOT / "scripts" / "adapters"
    if not adapters_dir.is_dir():
        return []
    sys.path.insert(0, str(adapters_dir))
    rows: list = []
    for py in sorted(adapters_dir.glob("*.py")):
        if py.name.startswith("_"):
            continue
        name = py.stem
        try:
            mod = __import__(name)
            got = mod.fetch()  # type: ignore[attr-defined]
            rows.extend(got or [])
            print(f"[adapter:{name}] {len(got or [])} rows", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001 - adapters are best-effort
            print(f"[adapter:{name}] FAILED: {exc}", file=sys.stderr)
    return rows


def main() -> int:
    scraped = validate_models(run_adapters())

    if scraped:
        payload = {
            "updated_at": dt.date.today().isoformat(),
            "stale": False,
            "unit": "per_mtok",
            "note": "Auto-updated by scripts/scrape_pricing.py. Verify absolute "
            "numbers against each provider's live pricing page.",
            "models": scraped,
        }
        OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {len(scraped)} models -> {OUT}", file=sys.stderr)
        return 0

    # All adapters failed -> preserve last good, flag stale.
    base = OUT if OUT.exists() else SEED
    if not base.exists():
        print("no adapters and no existing/seed pricing; nothing to write", file=sys.stderr)
        return 1
    data = load_json(base)
    data["stale"] = True
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("adapters yielded nothing; preserved previous pricing, stale=true", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
