# Task: parse_semver

Implement a Python function:

    def parse_semver(s: str) -> dict:

Parse a semantic version string into a dict with keys:
`major`, `minor`, `patch` (ints), `prerelease` (str or None), `build` (str or None).

Format: `MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]`
- `major`, `minor`, `patch` are required non-negative integers.
- Optional prerelease starts after `-`, up to `+` or end.
- Optional build metadata starts after `+`, up to end.

Examples of valid input:
- `"1.2.3"` -> major 1, minor 2, patch 3, prerelease None, build None
- `"1.0.0-alpha"` -> prerelease "alpha"
- `"1.0.0-alpha.1+build.5"` -> prerelease "alpha.1", build "build.5"
- `"1.2.3+meta"` -> build "meta", prerelease None

Invalid input (missing a component, non-numeric core, empty) must raise `ValueError`.

Return only the function definition. No prose, no tests, no example calls.
