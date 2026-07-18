#!/usr/bin/env python3
"""Hidden test runner for the A/B experiment.

Usage: python3 check.py <task_id> <candidate.py>
Prints JSON: {"task": id, "passed": n, "total": m}

Candidates never see these cases. Quality signal = passed/total.
"""
from __future__ import annotations

import importlib.util
import json
import sys
import traceback


def load(path: str):
    spec = importlib.util.spec_from_file_location("candidate", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # may raise -> counts as all-fail
    return mod


def cases(task: str):
    if task == "merge_intervals":
        f = "merge_intervals"
        return f, [
            ([[]], []),
            ([[[1, 3]]], [[1, 3]]),
            ([[[1, 3], [2, 6], [8, 10], [15, 18]]], [[1, 6], [8, 10], [15, 18]]),
            ([[[1, 4], [4, 5]]], [[1, 5]]),
            ([[[1, 4], [2, 3]]], [[1, 4]]),
            ([[[3, 5], [1, 2]]], [[1, 2], [3, 5]]),
            ([[[1, 4], [0, 4]]], [[0, 4]]),
            ([[[1, 4], [5, 6]]], [[1, 4], [5, 6]]),
        ]
    if task == "parse_semver":
        f = "parse_semver"

        def ok(s, major, minor, patch, pre, build):
            return (s,), {"major": major, "minor": minor, "patch": patch, "prerelease": pre, "build": build}

        return f, [
            ok("1.2.3", 1, 2, 3, None, None),
            ok("0.0.0", 0, 0, 0, None, None),
            ok("1.0.0-alpha", 1, 0, 0, "alpha", None),
            ok("1.0.0-alpha.1+build.5", 1, 0, 0, "alpha.1", "build.5"),
            ok("1.2.3+meta", 1, 2, 3, None, "meta"),
            ("__raises__", "1.2"),
            ("__raises__", "1.2.3.4"),
            ("__raises__", "a.b.c"),
            ("__raises__", ""),
        ]
    if task == "word_frequency":
        f = "word_frequency"
        return f, [
            (("The cat, the CAT! a cat.", 2), [("cat", 3), ("the", 2)]),
            (("b b a a c", 2), [("a", 2), ("b", 2)]),
            (("", 3), []),
            (("hello world", 0), []),
            (("don't don't do", 1), [("don't", 2)]),
            (("One one ONE two Two three", 2), [("one", 3), ("two", 2)]),
        ]
    raise SystemExit(f"unknown task {task}")


def run(task: str, path: str) -> dict:
    fname, tests = cases(task)
    try:
        mod = load(path)
        fn = getattr(mod, fname)
    except Exception:
        return {"task": task, "passed": 0, "total": len(tests), "error": "load/import failed"}

    passed = 0
    for spec in tests:
        try:
            if task == "parse_semver" and isinstance(spec[0], str) and spec[0] == "__raises__":
                try:
                    fn(spec[1])
                    continue  # should have raised
                except Exception:
                    passed += 1
                    continue
            if task == "parse_semver":
                args, expected = spec
                got = fn(*args)
                # accept dict or object with attributes
                if isinstance(got, dict):
                    d = got
                else:
                    d = {k: getattr(got, k, None) for k in expected}
                if all(d.get(k) == v for k, v in expected.items()):
                    passed += 1
                continue
            args, expected = spec
            got = fn(*args)
            if task == "word_frequency":
                got = [tuple(x) for x in got]
                expected = [tuple(x) for x in expected]
            if got == expected:
                passed += 1
        except Exception:
            pass
    return {"task": task, "passed": passed, "total": len(tests)}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: check.py <task_id> <candidate.py>")
    try:
        print(json.dumps(run(sys.argv[1], sys.argv[2])))
    except Exception:
        traceback.print_exc()
        raise SystemExit(1)
