import re
from collections import Counter


def word_frequency(text: str, top_n: int) -> list[tuple[str, int]]:
    if not text or top_n <= 0:
        return []
    words = re.findall(r"[a-z0-9']+", text.lower())
    counts = Counter(words)
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return ranked[:top_n]
