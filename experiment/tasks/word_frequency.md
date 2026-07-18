# Task: word_frequency

Implement a Python function:

    def word_frequency(text: str, top_n: int) -> list[tuple[str, int]]:

Return the `top_n` most frequent words in `text` as `(word, count)` tuples.

Rules:
- Case-insensitive: "The" and "the" are the same word; output words are lowercase.
- A "word" is a maximal run of letters, digits, and apostrophes (`'`). All other
  characters (punctuation, whitespace) are separators. So `don't` is one word.
- Sort by count descending; break ties by word ascending (alphabetical).
- Return at most `top_n` items. `top_n = 0` or empty text returns `[]`.

Examples:
- `word_frequency("The cat, the CAT! a cat.", 2)` -> `[("cat", 3), ("the", 2)]`
- `word_frequency("b b a a c", 2)` -> `[("a", 2), ("b", 2)]` (tie broken alphabetically)

Return only the function definition. No prose, no tests, no example calls.
