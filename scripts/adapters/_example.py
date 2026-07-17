"""Template pricing adapter.

Copy this file to `<provider>.py` (no leading underscore) and implement fetch().
Files starting with `_` are ignored by the scraper.

Return a list of model rows. Prices are USD per 1,000,000 tokens.

    {
      "id": "provider/model",     # required, unique
      "label": "Human name",      # optional, shown in the picker
      "tier": "S" | "M" | "F",    # required
      "in": 3.0,                  # required, input price /Mtok
      "out": 15.0,                # required, output price /Mtok
      "cache_read": 0.3           # optional, defaults to in * 0.1
    }

Guidance:
  - Prefer a machine-readable pricing endpoint (JSON) over scraping HTML.
  - Only return prices you actually parsed. If the source is unreachable or the
    layout changed, raise or return [] — never guess. The scraper preserves the
    previous good file and flags stale on total failure.
"""
from __future__ import annotations

import urllib.request


def _get_json(url: str, timeout: int = 15):
    req = urllib.request.Request(url, headers={"User-Agent": "agent-cost-sim/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
        import json

        return json.load(resp)


def fetch() -> list[dict]:
    # Example only. Real adapters implement provider-specific parsing here.
    return []
