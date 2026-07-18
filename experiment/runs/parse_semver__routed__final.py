def parse_semver(s: str) -> dict:
    if not s:
        raise ValueError("empty version string")

    rest = s
    build = None
    prerelease = None

    if '+' in rest:
        rest, build = rest.split('+', 1)
        if build == '':
            raise ValueError("empty build metadata")

    if '-' in rest:
        rest, prerelease = rest.split('-', 1)
        if prerelease == '':
            raise ValueError("empty prerelease")

    parts = rest.split('.')
    if len(parts) != 3:
        raise ValueError("core must be MAJOR.MINOR.PATCH")

    for p in parts:
        if not p.isdigit():
            raise ValueError(f"non-numeric core component: {p!r}")

    major, minor, patch = (int(p) for p in parts)

    return {
        "major": major,
        "minor": minor,
        "patch": patch,
        "prerelease": prerelease,
        "build": build,
    }
