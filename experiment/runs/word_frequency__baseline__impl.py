import re
from collections import Counter


def word_frequency(text: str, top_n: int) -> list[tuple[str, int]]:
    if top_n <= 0 or not text:
        return []
    tokens = re.findall(r"[a-z0-9']+", text.lower())
    if not tokens:
        return []
    counter = Counter(tokens)
    ordered = sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))
    return ordered[:top_n]
