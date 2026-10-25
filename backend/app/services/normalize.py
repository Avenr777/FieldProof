"""
Normalisation helpers for extracted field values.

Converts spoken/raw strings to canonical forms so downstream comparisons
(compliance checks, grounding, evaluation exact-match) work reliably.

All functions are pure (no I/O, no DB) so they can be unit-tested easily.
"""
from __future__ import annotations

import re
from typing import Any


# ---------------------------------------------------------------------------
# Number words → digits
# ---------------------------------------------------------------------------

_ONES = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4,
    "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
    "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
}
_TENS = {
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
}
_MULTIPLIERS = {
    "hundred": 100, "thousand": 1000, "million": 1_000_000,
}


def words_to_number(text: str) -> int | float | None:
    """
    Convert a simple English number phrase to a numeric value.
    Returns None if the text doesn't look like a number phrase.

    Examples::
        words_to_number("twenty amp")   -> 20
        words_to_number("two hundred")  -> 200
        words_to_number("32")           -> 32
        words_to_number("hello")        -> None
    """
    text = text.strip().lower()

    # Already a numeric literal?
    try:
        return int(text)
    except ValueError:
        pass
    try:
        return float(text)
    except ValueError:
        pass

    tokens = re.split(r"[\s\-]+", text)
    tokens = [t for t in tokens if t and t not in ("and", "a", "an")]
    if not tokens:
        return None

    total = 0
    current = 0
    found_any = False
    for tok in tokens:
        if tok in _ONES:
            current += _ONES[tok]
            found_any = True
        elif tok in _TENS:
            current += _TENS[tok]
            found_any = True
        elif tok in _MULTIPLIERS:
            m = _MULTIPLIERS[tok]
            if m >= 1000:
                total = (total + current) * m
            else:
                current *= m
            found_any = True
        else:
            return None  # unexpected token

    if not found_any:
        return None
    return total + current


# ---------------------------------------------------------------------------
# Unit normalisation
# ---------------------------------------------------------------------------

_AMPERE_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:amp(?:ere)?s?|amps?|a\b)", re.IGNORECASE
)
_VOLT_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:volts?|v\b)", re.IGNORECASE
)
_WATT_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:kilowatts?|kw\b|watts?|w\b)", re.IGNORECASE
)
_OHM_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:ohms?|Ω)", re.IGNORECASE
)


def normalise_unit(raw: str) -> str:
    """
    Normalise a measurement string to a canonical form.

    Examples::
        normalise_unit("twenty amp")  -> "20A"
        normalise_unit("230 volts")   -> "230V"
        normalise_unit("3.5 kW")      -> "3.5kW"
        normalise_unit("hello")       -> "hello"
    """
    if not raw or not isinstance(raw, str):
        return raw or ""

    text = raw.strip()

    # Replace spelled-out number prefix with digits before unit matching
    parts = text.split(None, 1)
    if len(parts) == 2:
        num = words_to_number(parts[0])
        if num is not None:
            text = f"{num} {parts[1]}"

    m = _AMPERE_RE.search(text)
    if m:
        return f"{_fmt_num(m.group(1))}A"

    m = _VOLT_RE.search(text)
    if m:
        return f"{_fmt_num(m.group(1))}V"

    # kW check before plain W
    m = _WATT_RE.search(text)
    if m:
        v = _fmt_num(m.group(1))
        if re.search(r"kilo|kw", text, re.IGNORECASE):
            return f"{v}kW"
        return f"{v}W"

    m = _OHM_RE.search(text)
    if m:
        return f"{_fmt_num(m.group(1))}Ω"

    return text


def _fmt_num(s: str) -> str:
    """Format a numeric string, removing trailing .0 for integers."""
    try:
        f = float(s)
        if f == int(f):
            return str(int(f))
        return str(f)
    except ValueError:
        return s


# ---------------------------------------------------------------------------
# Date normalisation
# ---------------------------------------------------------------------------

_MONTH_NAMES = {
    "january": 1, "jan": 1, "february": 2, "feb": 2,
    "march": 3, "mar": 3, "april": 4, "apr": 4,
    "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
    "august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10, "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}
_DATE_RE = re.compile(
    r"(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})"
)
_VERBAL_DATE_RE = re.compile(
    r"(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(\w+)\s+(\d{4})",
    re.IGNORECASE,
)


def normalise_date(raw: str) -> str:
    """
    Normalise a date string to ISO-8601 (YYYY-MM-DD).
    Returns the original string if it can't be parsed.

    Examples::
        normalise_date("25/10/2026")          -> "2026-10-25"
        normalise_date("25th October 2026")   -> "2026-10-25"
    """
    if not raw:
        return raw

    m = _DATE_RE.search(raw)
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        if len(y) == 2:
            y = f"20{y}"
        return f"{y}-{int(mo):02d}-{int(d):02d}"

    m = _VERBAL_DATE_RE.search(raw)
    if m:
        day, month_word, year = m.group(1), m.group(2).lower(), m.group(3)
        mo = _MONTH_NAMES.get(month_word)
        if mo:
            return f"{year}-{mo:02d}-{int(day):02d}"

    return raw


# ---------------------------------------------------------------------------
# General field normaliser (dispatcher)
# ---------------------------------------------------------------------------

_FIELD_UNIT_HINTS = {
    "voltage", "volt", "rating", "current", "ampere", "amp",
    "power", "watt", "resistance", "ohm", "reading", "measurement",
}


def normalise_field_value(field_name: str, raw_value: Any) -> Any:
    """
    Apply appropriate normalisation based on field name.
    Returns the normalised value (preserves type when no normalisation applies).
    """
    if raw_value is None:
        return None
    if not isinstance(raw_value, str):
        return raw_value

    fname = field_name.lower()

    # Date fields
    if any(kw in fname for kw in ("date", "time", "when")):
        return normalise_date(raw_value)

    # Unit fields
    if any(kw in fname for kw in _FIELD_UNIT_HINTS):
        normalised = normalise_unit(raw_value)
        if normalised != raw_value:
            return normalised

    return raw_value
