# Task: merge_intervals

Implement a Python function:

    def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:

Given a list of `[start, end]` integer intervals (possibly unsorted, possibly
overlapping, possibly nested), return the minimal list of merged intervals,
sorted ascending by start.

Rules:
- Intervals that overlap OR merely touch (e.g. `[1,4]` and `[4,5]`) merge into one.
- A nested interval (`[2,3]` inside `[1,4]`) is absorbed.
- Empty input returns `[]`.
- Output intervals are `[start, end]` lists, sorted by start ascending.

Return only the function definition. No prose, no tests, no example calls.
