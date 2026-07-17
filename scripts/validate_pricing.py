#!/usr/bin/env python3
"""Schema gate for data/pricing.json. Exit non-zero blocks the commit/deploy."""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "pricing.json"
VALID_TIERS = {"S", "M", "F"}


def main() -> int:
    if not PATH.exists():
        print("missing data/pricing.json", file=sys.stderr)
        return 1
    try:
        data = json.loads(PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"invalid JSON: {exc}", file=sys.stderr)
        return 1

    models = data.get("models")
    if not isinstance(models, list) or not models:
        print("models must be a non-empty array", file=sys.stderr)
        return 1

    tiers_seen = set()
    ids = set()
    errors = []
    for i, m in enumerate(models):
        for f in ("id", "tier", "in", "out"):
            if f not in m:
                errors.append(f"model[{i}] missing {f}")
        if m.get("tier") not in VALID_TIERS:
            errors.append(f"model[{i}] bad tier {m.get('tier')!r}")
        if m.get("id") in ids:
            errors.append(f"duplicate id {m.get('id')!r}")
        ids.add(m.get("id"))
        for f in ("in", "out", "cache_read"):
            if f in m and (not isinstance(m[f], (int, float)) or m[f] < 0):
                errors.append(f"model[{i}].{f} must be a non-negative number")
        tiers_seen.add(m.get("tier"))

    for tier in VALID_TIERS:
        if tier not in tiers_seen:
            errors.append(f"no model for tier {tier} (calculator needs all of S/M/F)")

    if errors:
        print("VALIDATION FAILED:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    print(f"OK: {len(models)} models, tiers={sorted(tiers_seen)}, updated_at={data.get('updated_at')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
