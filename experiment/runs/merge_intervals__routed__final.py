def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:
    if not intervals:
        return []

    sorted_intervals = sorted(intervals, key=lambda iv: iv[0])

    merged: list[list[int]] = []
    current_start, current_end = sorted_intervals[0][0], sorted_intervals[0][1]

    for start, end in sorted_intervals[1:]:
        if start <= current_end:
            current_end = max(current_end, end)
        else:
            merged.append([current_start, current_end])
            current_start, current_end = start, end

    merged.append([current_start, current_end])
    return merged
