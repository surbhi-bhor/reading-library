"""English display names, copied from the main project's
dagster/ops/openlib_op.py (copied, not imported)."""
import difflib
import re
import unicodedata
from typing import Optional

AUTHOR_MATCH_RATIO = 0.85

def normalize_name(name: str) -> str:
    """Accent-free, lowercase, letters and spaces only: 'Elif Şafak' and
    'Elif Shafak' become 'elif safak' and 'elif shafak'."""
    decomposed = unicodedata.normalize("NFKD", name)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return " ".join(re.sub(r"[^\w\s]", " ", stripped.lower()).split())

def author_matches(author: str, candidates: list) -> bool:
    """Substring either way ('J.K. Rowling' vs 'J. K. Rowling'), or close
    spelling for transliterated names ('Elif Shafak' vs 'Elif Şafak')."""
    target = normalize_name(author)
    for candidate in candidates:
        c = normalize_name(candidate)
        if not c:
            continue
        if target in c or c in target:
            return True
        if difflib.SequenceMatcher(None, target, c).ratio() >= AUTHOR_MATCH_RATIO:
            return True
    return False

def is_latin_script(text: str) -> bool:
    """True when every letter is Latin script, accents allowed: 'Emily
    Brontë', 'Gabriel García Márquez' and 'Vālmīki' pass; '村上春樹' and
    'Аркадий Стругацкий' do not."""
    return all("LATIN" in unicodedata.name(ch, "") for ch in text if ch.isalpha())

def english_author_name(names: list, alternative_names: list = ()) -> Optional[str]:
    """English (Latin-script) form of a book's author for display.

    Open Library often lists the original-script name first ('村上春樹' for
    Haruki Murakami, '川口俊和' for Toshikazu Kawaguchi). Prefer a Latin name
    from author_name; otherwise pick one from author_alternative_name, which
    mixes 'Haruki Murakami', 'MURAKAMI Haruki', 'Kawaguchi, Toshikazu' and
    other scripts. Skips catalogue forms (commas, semicolons, all-caps
    words) and takes the first name whose words appear most often, so the
    common spelling wins over a one-off variant. None if there is no Latin
    form at all."""
    for name in names or []:
        if name and is_latin_script(name):
            return name.strip()

    latin = [n.strip() for n in (alternative_names or []) if n and is_latin_script(n)]

    def word_set(name: str) -> frozenset:
        return frozenset(normalize_name(name).split())

    def readable(name: str) -> bool:
        words = name.split()
        return (
            "," not in name and ";" not in name and 2 <= len(words) <= 4
            and not any(len(w) > 2 and w.isupper() for w in words)
        )

    counts = {}
    for name in latin:
        counts[word_set(name)] = counts.get(word_set(name), 0) + 1
    readable_names = [n for n in latin if readable(n)]
    if not readable_names:
        return None
    return max(readable_names, key=lambda n: counts[word_set(n)])
