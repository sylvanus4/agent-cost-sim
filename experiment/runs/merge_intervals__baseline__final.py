def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:
    if not intervals:
        return []
    ordered = sorted(intervals, key=lambda iv: iv[0])
    result: list[list[int]] = [list(ordered[0])]
    for cur in ordered[1:]:
        last = result[-1]
        if cur[0] <= last[1]:
            last[1] = max(last[1], cur[1])
        else:
            result.append(list(cur))
    return result
