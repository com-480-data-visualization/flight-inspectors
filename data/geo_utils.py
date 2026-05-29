"""
geo_utils.py — shared city → country → continent resolution
Used by generate_crashes_for_poisson.py and generate_crashes_for_chord.py

Dependencies: geonamescache, pycountry-convert
  pip install geonamescache pycountry-convert

Disambiguation strategy:
  - Build a lookup of 280 k+ entries: city name / alternate name → city record
  - When multiple cities share a name, the one with the highest population wins
    (London → United Kingdom, not Ontario; Paris → France, not Texas)
  - Airport suffixes are stripped progressively so "London Heathrow" → "London"
"""

import re
import unicodedata
from functools import lru_cache

import geonamescache
import pycountry_convert as pc

# ---------------------------------------------------------------------------
# Build lookup once at import time
# ---------------------------------------------------------------------------
_gc      = geonamescache.GeonamesCache()
_cities  = _gc.get_cities()
_countries_meta = _gc.get_countries()   # iso → {name, continentcode, ...}

# alpha2 → country display name
ALPHA2_TO_COUNTRY: dict[str, str] = {
    v['iso']: v['name'] for v in _countries_meta.values()
}

def _norm(s: str) -> str:
    """Lowercase + strip diacritics."""
    s = s.lower().strip()
    return ''.join(
        c for c in unicodedata.normalize('NFD', s)
        if unicodedata.category(c) != 'Mn'
    )

# name/altname → best (highest-population) city record
_CITY_LOOKUP: dict[str, dict] = {}

def _add(key: str, city: dict) -> None:
    key = _norm(key)
    if not key:
        return
    existing = _CITY_LOOKUP.get(key)
    if existing is None or city['population'] > existing['population']:
        _CITY_LOOKUP[key] = city

for _v in _cities.values():
    _add(_v['name'], _v)
    for _alt in _v.get('alternatenames', []):
        _add(_alt, _v)

# Words to strip from raw airport/city strings before lookup
_AIRPORT_WORDS = re.compile(
    r'\b(international|intl|airport|air\s*base|airfield|afb|aaf|'
    r'municipal|regional|executive|field|heliport|strip|seaplane)\b',
    re.IGNORECASE,
)
_PARENS  = re.compile(r'\([^)]*\)')
_AFTER_COMMA = re.compile(r',.*$')


def _clean(raw: str) -> str:
    """Strip airport jargon, parentheses, and everything after a comma."""
    s = _PARENS.sub('', raw)
    s = _AIRPORT_WORDS.sub('', s)
    s = _AFTER_COMMA.sub('', s)
    return re.sub(r'\s+', ' ', s).strip()


@lru_cache(maxsize=8192)
def resolve_city(raw: str) -> dict | None:
    """
    Return the geonamescache city record for `raw`, or None.

    Algorithm:
      1. Clean the string (strip airport words, parens, after-comma).
      2. Try exact normalised lookup.
      3. If not found, drop the last word and retry — repeating until
         a single word remains.  This handles "London Heathrow" → "London".
    """
    cleaned = _clean(raw)
    parts   = cleaned.split()
    for n in range(len(parts), 0, -1):
        hit = _CITY_LOOKUP.get(_norm(' '.join(parts[:n])))
        if hit:
            return hit
    return None


def city_to_country(raw: str) -> str:
    """Return the full country name for a raw city string, or 'Unknown'."""
    city = resolve_city(raw)
    if city is None:
        return 'Unknown'
    return ALPHA2_TO_COUNTRY.get(city['countrycode'], 'Unknown')


def city_to_alpha2(raw: str) -> str | None:
    """Return the ISO alpha-2 country code for a raw city string, or None."""
    city = resolve_city(raw)
    return city['countrycode'] if city else None


@lru_cache(maxsize=512)
def alpha2_to_continent(alpha2: str) -> str:
    """Return the full continent name for an ISO alpha-2 country code."""
    try:
        code = pc.country_alpha2_to_continent_code(alpha2)
        return pc.convert_continent_code_to_continent_name(code)
    except Exception:
        return 'Unknown'


def city_to_continent(raw: str) -> str:
    """Return the full continent name for a raw city string."""
    a2 = city_to_alpha2(raw)
    return alpha2_to_continent(a2) if a2 else 'Unknown'


def decade_label(year: int) -> str:
    """Return the decade string for a year, e.g. 1985 → '1980s'."""
    return f"{(year // 10) * 10}s"
