import re

_SEMVER_RE = re.compile(r'^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?(?:\+(.+))?$')


def parse_semver(s: str) -> dict:
    if not isinstance(s, str):
        raise ValueError(f"invalid semver: {s!r}")
    m = _SEMVER_RE.fullmatch(s)
    if m is None:
        raise ValueError(f"invalid semver: {s!r}")
    return {
        "major": int(m.group(1)),
        "minor": int(m.group(2)),
        "patch": int(m.group(3)),
        "prerelease": m.group(4),
        "build": m.group(5),
    }
