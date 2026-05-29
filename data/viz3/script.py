"""
Viz3 - Choropleth + treemap: incidents & fatalities by country per year
Generates: public/data/crashes_by_country.json

Output schema:
  [{ year, iso, name, continent, incidents, fatalities }, ...]
    - iso: numeric ISO-3166-1 code (matches world-atlas countries-110m.json `id`)
    - continent: one of {Africa, Asia, Europe, North America, Oceania, South America}

The `Location` column has the form "<place>, <region>, <country-or-state>".
We take the last comma-separated token and normalise it:
  - US state names -> United States (840)
  - England/Scotland/Wales/Northern Ireland -> United Kingdom (826)
  - "USSR" -> Russia (643), "South Vietnam" -> Vietnam (704), etc.
  - "Georgia" disambiguated by inspecting the preceding token (Tbilisi/Sukhumi/...
    -> country of Georgia, otherwise -> United States [Atlanta, Savannah, ...]).
"""

import csv
import json
import os
import re
from collections import defaultdict

US_STATES = {
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
    'connecticut', 'delaware', 'florida', 'hawaii', 'idaho', 'illinois',
    'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland',
    'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri',
    'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey',
    'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
    'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina',
    'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia',
    'washington', 'west virginia', 'wisconsin', 'wyoming',
    'district of columbia', 'd.c.', 'dc',
    'puerto rico', 'guam', 'american samoa', 'us virgin islands',
    'u.s. virgin islands', 'northern mariana islands',
    # common misspellings
    'minnisota', 'pensylvania', 'massachussetts',
}

# US state postal abbreviations
US_STATE_ABBR = {
    'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id',
    'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms',
    'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok',
    'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv',
    'wi', 'wy', 'pr',
}

# Common misspellings -> canonical
MISSPELLINGS = {
    'columbia': 'colombia',
    'bulgeria': 'bulgaria',
    'unied kingdom': 'united kingdom',
    'venuzuela': 'venezuela',
    'phillipines': 'philippines',
    'philipines': 'philippines',
    'thialand': 'thailand',
    'kazahkstan': 'kazakhstan',
    'rep. congo': 'congo',
    'republic of congo': 'congo',
}

UK_REGIONS = {'england', 'scotland', 'wales', 'northern ireland', 'uk', 'u.k.'}

# Last-token  ->  (iso_numeric, canonical_name, continent)
COUNTRY_MAP = {
    # ---- North America ----
    'usa': (840, 'United States', 'North America'),
    'united states': (840, 'United States', 'North America'),
    'united states of america': (840, 'United States', 'North America'),
    'u.s.': (840, 'United States', 'North America'),
    'u.s.a.': (840, 'United States', 'North America'),
    'canada': (124, 'Canada', 'North America'),
    'mexico': (484, 'Mexico', 'North America'),
    'cuba': (192, 'Cuba', 'North America'),
    'haiti': (332, 'Haiti', 'North America'),
    'dominican republic': (214, 'Dominican Republic', 'North America'),
    'jamaica': (388, 'Jamaica', 'North America'),
    'bahamas': (44, 'Bahamas', 'North America'),
    'honduras': (340, 'Honduras', 'North America'),
    'guatemala': (320, 'Guatemala', 'North America'),
    'nicaragua': (558, 'Nicaragua', 'North America'),
    'costa rica': (188, 'Costa Rica', 'North America'),
    'panama': (591, 'Panama', 'North America'),
    'el salvador': (222, 'El Salvador', 'North America'),
    'belize': (84, 'Belize', 'North America'),
    'trinidad and tobago': (780, 'Trinidad and Tobago', 'North America'),
    'trinidad': (780, 'Trinidad and Tobago', 'North America'),
    'martinique': (840, 'United States', 'North America'),  # rare; skip
    'greenland': (304, 'Greenland', 'North America'),
    'bermuda': (60, 'Bermuda', 'North America'),

    # ---- South America ----
    'brazil': (76, 'Brazil', 'South America'),
    'colombia': (170, 'Colombia', 'South America'),
    'argentina': (32, 'Argentina', 'South America'),
    'peru': (604, 'Peru', 'South America'),
    'venezuela': (862, 'Venezuela', 'South America'),
    'chile': (152, 'Chile', 'South America'),
    'bolivia': (68, 'Bolivia', 'South America'),
    'ecuador': (218, 'Ecuador', 'South America'),
    'paraguay': (600, 'Paraguay', 'South America'),
    'uruguay': (858, 'Uruguay', 'South America'),
    'guyana': (328, 'Guyana', 'South America'),
    'suriname': (740, 'Suriname', 'South America'),
    'french guiana': (250, 'France', 'South America'),  # overseas dept

    # ---- Europe ----
    'france': (250, 'France', 'Europe'),
    'germany': (276, 'Germany', 'Europe'),
    'west germany': (276, 'Germany', 'Europe'),
    'east germany': (276, 'Germany', 'Europe'),
    'italy': (380, 'Italy', 'Europe'),
    'spain': (724, 'Spain', 'Europe'),
    'portugal': (620, 'Portugal', 'Europe'),
    'united kingdom': (826, 'United Kingdom', 'Europe'),
    'uk': (826, 'United Kingdom', 'Europe'),
    'u.k.': (826, 'United Kingdom', 'Europe'),
    'great britain': (826, 'United Kingdom', 'Europe'),
    'ireland': (372, 'Ireland', 'Europe'),
    'netherlands': (528, 'Netherlands', 'Europe'),
    'holland': (528, 'Netherlands', 'Europe'),
    'belgium': (56, 'Belgium', 'Europe'),
    'luxembourg': (442, 'Luxembourg', 'Europe'),
    'switzerland': (756, 'Switzerland', 'Europe'),
    'austria': (40, 'Austria', 'Europe'),
    'poland': (616, 'Poland', 'Europe'),
    'czech republic': (203, 'Czech Republic', 'Europe'),
    'czechoslovakia': (203, 'Czech Republic', 'Europe'),
    'slovakia': (703, 'Slovakia', 'Europe'),
    'hungary': (348, 'Hungary', 'Europe'),
    'romania': (642, 'Romania', 'Europe'),
    'bulgaria': (100, 'Bulgaria', 'Europe'),
    'greece': (300, 'Greece', 'Europe'),
    'albania': (8, 'Albania', 'Europe'),
    'serbia': (688, 'Serbia', 'Europe'),
    'yugoslavia': (688, 'Serbia', 'Europe'),
    'croatia': (191, 'Croatia', 'Europe'),
    'bosnia': (70, 'Bosnia and Herzegovina', 'Europe'),
    'bosnia and herzegovina': (70, 'Bosnia and Herzegovina', 'Europe'),
    'slovenia': (705, 'Slovenia', 'Europe'),
    'macedonia': (807, 'North Macedonia', 'Europe'),
    'north macedonia': (807, 'North Macedonia', 'Europe'),
    'montenegro': (499, 'Montenegro', 'Europe'),
    'kosovo': (688, 'Serbia', 'Europe'),
    'finland': (246, 'Finland', 'Europe'),
    'sweden': (752, 'Sweden', 'Europe'),
    'norway': (578, 'Norway', 'Europe'),
    'denmark': (208, 'Denmark', 'Europe'),
    'iceland': (352, 'Iceland', 'Europe'),
    'estonia': (233, 'Estonia', 'Europe'),
    'latvia': (428, 'Latvia', 'Europe'),
    'lithuania': (440, 'Lithuania', 'Europe'),
    'belarus': (112, 'Belarus', 'Europe'),
    'ukraine': (804, 'Ukraine', 'Europe'),
    'moldova': (498, 'Moldova', 'Europe'),
    'russia': (643, 'Russia', 'Europe'),
    'russian federation': (643, 'Russia', 'Europe'),
    'ussr': (643, 'Russia', 'Europe'),
    'soviet union': (643, 'Russia', 'Europe'),
    'malta': (470, 'Malta', 'Europe'),
    'cyprus': (196, 'Cyprus', 'Europe'),

    # ---- Asia ----
    'china': (156, 'China', 'Asia'),
    "people's republic of china": (156, 'China', 'Asia'),
    'taiwan': (158, 'Taiwan', 'Asia'),
    'india': (356, 'India', 'Asia'),
    'pakistan': (586, 'Pakistan', 'Asia'),
    'bangladesh': (50, 'Bangladesh', 'Asia'),
    'sri lanka': (144, 'Sri Lanka', 'Asia'),
    'nepal': (524, 'Nepal', 'Asia'),
    'bhutan': (64, 'Bhutan', 'Asia'),
    'maldives': (462, 'Maldives', 'Asia'),
    'japan': (392, 'Japan', 'Asia'),
    'south korea': (410, 'South Korea', 'Asia'),
    'north korea': (408, 'North Korea', 'Asia'),
    'korea': (410, 'South Korea', 'Asia'),
    'mongolia': (496, 'Mongolia', 'Asia'),
    'vietnam': (704, 'Vietnam', 'Asia'),
    'south vietnam': (704, 'Vietnam', 'Asia'),
    'north vietnam': (704, 'Vietnam', 'Asia'),
    'laos': (418, 'Laos', 'Asia'),
    'cambodia': (116, 'Cambodia', 'Asia'),
    'thailand': (764, 'Thailand', 'Asia'),
    'myanmar': (104, 'Myanmar', 'Asia'),
    'burma': (104, 'Myanmar', 'Asia'),
    'malaysia': (458, 'Malaysia', 'Asia'),
    'indonesia': (360, 'Indonesia', 'Asia'),
    'philippines': (608, 'Philippines', 'Asia'),
    'singapore': (702, 'Singapore', 'Asia'),
    'brunei': (96, 'Brunei', 'Asia'),
    'east timor': (626, 'Timor-Leste', 'Asia'),
    'timor leste': (626, 'Timor-Leste', 'Asia'),
    'kazakhstan': (398, 'Kazakhstan', 'Asia'),
    'uzbekistan': (860, 'Uzbekistan', 'Asia'),
    'kyrgyzstan': (417, 'Kyrgyzstan', 'Asia'),
    'tajikistan': (762, 'Tajikistan', 'Asia'),
    'turkmenistan': (795, 'Turkmenistan', 'Asia'),
    'afghanistan': (4, 'Afghanistan', 'Asia'),
    'iran': (364, 'Iran', 'Asia'),
    'iraq': (368, 'Iraq', 'Asia'),
    'syria': (760, 'Syria', 'Asia'),
    'lebanon': (422, 'Lebanon', 'Asia'),
    'israel': (376, 'Israel', 'Asia'),
    'palestine': (275, 'Palestine', 'Asia'),
    'jordan': (400, 'Jordan', 'Asia'),
    'saudi arabia': (682, 'Saudi Arabia', 'Asia'),
    'yemen': (887, 'Yemen', 'Asia'),
    'oman': (512, 'Oman', 'Asia'),
    'uae': (784, 'UAE', 'Asia'),
    'united arab emirates': (784, 'UAE', 'Asia'),
    'qatar': (634, 'Qatar', 'Asia'),
    'bahrain': (48, 'Bahrain', 'Asia'),
    'kuwait': (414, 'Kuwait', 'Asia'),
    'turkey': (792, 'Turkey', 'Asia'),
    'armenia': (51, 'Armenia', 'Asia'),
    'azerbaijan': (31, 'Azerbaijan', 'Asia'),
    'hong kong': (156, 'China', 'Asia'),
    'macau': (156, 'China', 'Asia'),

    # ---- Africa ----
    'egypt': (818, 'Egypt', 'Africa'),
    'libya': (434, 'Libya', 'Africa'),
    'tunisia': (788, 'Tunisia', 'Africa'),
    'algeria': (12, 'Algeria', 'Africa'),
    'morocco': (504, 'Morocco', 'Africa'),
    'western sahara': (732, 'W. Sahara', 'Africa'),
    'sudan': (729, 'Sudan', 'Africa'),
    'south sudan': (728, 'South Sudan', 'Africa'),
    'ethiopia': (231, 'Ethiopia', 'Africa'),
    'eritrea': (232, 'Eritrea', 'Africa'),
    'djibouti': (262, 'Djibouti', 'Africa'),
    'somalia': (706, 'Somalia', 'Africa'),
    'kenya': (404, 'Kenya', 'Africa'),
    'uganda': (800, 'Uganda', 'Africa'),
    'tanzania': (834, 'Tanzania', 'Africa'),
    'rwanda': (646, 'Rwanda', 'Africa'),
    'burundi': (108, 'Burundi', 'Africa'),
    'nigeria': (566, 'Nigeria', 'Africa'),
    'ghana': (288, 'Ghana', 'Africa'),
    'ivory coast': (384, "Cote d'Ivoire", 'Africa'),
    "cote d'ivoire": (384, "Cote d'Ivoire", 'Africa'),
    'senegal': (686, 'Senegal', 'Africa'),
    'gambia': (270, 'Gambia', 'Africa'),
    'guinea': (324, 'Guinea', 'Africa'),
    'guinea-bissau': (624, 'Guinea-Bissau', 'Africa'),
    'sierra leone': (694, 'Sierra Leone', 'Africa'),
    'liberia': (430, 'Liberia', 'Africa'),
    'mali': (466, 'Mali', 'Africa'),
    'burkina faso': (854, 'Burkina Faso', 'Africa'),
    'niger': (562, 'Niger', 'Africa'),
    'chad': (148, 'Chad', 'Africa'),
    'mauritania': (478, 'Mauritania', 'Africa'),
    'cameroon': (120, 'Cameroon', 'Africa'),
    'central african republic': (140, 'Central African Republic', 'Africa'),
    'gabon': (266, 'Gabon', 'Africa'),
    'equatorial guinea': (226, 'Equatorial Guinea', 'Africa'),
    'congo': (180, 'DR Congo', 'Africa'),
    'democratic republic of the congo': (180, 'DR Congo', 'Africa'),
    'zaire': (180, 'DR Congo', 'Africa'),
    'angola': (24, 'Angola', 'Africa'),
    'zambia': (894, 'Zambia', 'Africa'),
    'zimbabwe': (716, 'Zimbabwe', 'Africa'),
    'rhodesia': (716, 'Zimbabwe', 'Africa'),
    'mozambique': (508, 'Mozambique', 'Africa'),
    'malawi': (454, 'Malawi', 'Africa'),
    'botswana': (72, 'Botswana', 'Africa'),
    'namibia': (516, 'Namibia', 'Africa'),
    'south africa': (710, 'South Africa', 'Africa'),
    'lesotho': (426, 'Lesotho', 'Africa'),
    'swaziland': (748, 'eSwatini', 'Africa'),
    'eswatini': (748, 'eSwatini', 'Africa'),
    'madagascar': (450, 'Madagascar', 'Africa'),
    'comoros': (174, 'Comoros', 'Africa'),
    'mauritius': (480, 'Mauritius', 'Africa'),
    'seychelles': (690, 'Seychelles', 'Africa'),
    'cape verde': (132, 'Cape Verde', 'Africa'),
    'sao tome': (678, 'Sao Tome and Principe', 'Africa'),
    'togo': (768, 'Togo', 'Africa'),
    'benin': (204, 'Benin', 'Africa'),

    # ---- Oceania ----
    'australia': (36, 'Australia', 'Oceania'),
    'new zealand': (554, 'New Zealand', 'Oceania'),
    'papua new guinea': (598, 'Papua New Guinea', 'Oceania'),
    'new guinea': (598, 'Papua New Guinea', 'Oceania'),
    'fiji': (242, 'Fiji', 'Oceania'),
    'solomon islands': (90, 'Solomon Islands', 'Oceania'),
    'vanuatu': (548, 'Vanuatu', 'Oceania'),
    'samoa': (882, 'Samoa', 'Oceania'),
    'tonga': (776, 'Tonga', 'Oceania'),
    'new caledonia': (250, 'France', 'Oceania'),  # rare; map to FR
    'french polynesia': (250, 'France', 'Oceania'),
    'kiribati': (296, 'Kiribati', 'Oceania'),
    'micronesia': (583, 'Micronesia', 'Oceania'),
    'palau': (585, 'Palau', 'Oceania'),
}

# Locations to deliberately drop (no country resolvable)
DROP_TOKENS = {
    '?', 'over the atlantic', 'over the pacific', 'over the indian ocean',
    'atlantic ocean', 'pacific ocean', 'indian ocean', 'mediterranean sea',
    'north atlantic ocean', 'south atlantic ocean', 'mediterranean',
    'caribbean sea', 'gulf of mexico', 'north sea', 'baltic sea',
    'caspian sea', 'black sea', 'red sea', 'persian gulf', 'arabian sea',
    'south china sea', 'east china sea', 'sea of japan',
    'antarctica', 'arctic ocean', 'english channel',
}

# Specific phrases (e.g. "Tbilisi, Georgia") that resolve Georgia ambiguity
GEORGIA_COUNTRY_CITIES = {
    'tbilisi', 'sukhumi', 'zugdidi', 'svanetia', 'ochamchire', 'tkvarcheli',
    'lata', 'batumi', 'kutaisi', 'rustavi',
}


def normalize(token: str) -> str:
    """Lowercase, strip punctuation/whitespace."""
    t = token.lower().strip()
    t = re.sub(r'\s+', ' ', t)
    return t


def resolve_country(location: str):
    """Return (iso, name, continent) or None if not resolvable."""
    parts = [p.strip() for p in location.split(',') if p.strip()]
    if not parts:
        return None
    last = normalize(parts[-1])

    # Drop blatantly-not-a-country
    if last in DROP_TOKENS or last.startswith('off ') or last.startswith('near '):
        # could still be salvageable if there's another token
        if len(parts) > 1:
            last = normalize(parts[-2])
            if last in DROP_TOKENS:
                return None
        else:
            return None

    # Strip "near " / "off " prefixes
    last = re.sub(r'^(near|off|over|above)\s+', '', last)

    # Misspelling correction
    if last in MISSPELLINGS:
        last = MISSPELLINGS[last]

    # US state postal abbrev
    if last in US_STATE_ABBR:
        return (840, 'United States', 'North America')

    # Georgia disambiguation
    if last == 'georgia':
        if len(parts) >= 2:
            prev = normalize(parts[-2]).replace('near ', '').replace('off ', '')
            # Strip city qualifier ("Near Tbilisi" -> "tbilisi")
            prev_first = prev.split()[-1] if prev else ''
            if any(c in prev for c in GEORGIA_COUNTRY_CITIES) or prev_first in GEORGIA_COUNTRY_CITIES:
                return (268, 'Georgia', 'Asia')
        return (840, 'United States', 'North America')

    # US state?
    if last in US_STATES:
        return (840, 'United States', 'North America')

    # UK region?
    if last in UK_REGIONS:
        return (826, 'United Kingdom', 'Europe')

    # Direct country lookup
    if last in COUNTRY_MAP:
        return COUNTRY_MAP[last]

    # Try second-to-last (sometimes Location ends with a US county / region)
    if len(parts) >= 2:
        prev = normalize(parts[-2])
        if prev in US_STATES:
            return (840, 'United States', 'North America')
        if prev in COUNTRY_MAP:
            return COUNTRY_MAP[prev]
        if prev in UK_REGIONS:
            return (826, 'United Kingdom', 'Europe')

    return None


def main():
    src = os.path.join(os.path.dirname(__file__), '..', 'crashes_cleaned.csv')
    rows = list(csv.DictReader(open(src, encoding='utf-8')))

    # data[year][iso] -> {incidents, fatalities, name, continent}
    data = defaultdict(lambda: defaultdict(lambda: {
        'incidents': 0, 'fatalities': 0, 'name': '', 'continent': ''
    }))
    resolved, unresolved = 0, 0
    unresolved_sample = []

    for r in rows:
        loc = (r.get('Location') or '').strip()
        if not loc:
            continue
        try:
            year = int(r['Year'])
        except (ValueError, KeyError):
            continue
        try:
            fat = float(r['Fatalities']) if r['Fatalities'] else 0
        except ValueError:
            fat = 0

        res = resolve_country(loc)
        if res is None:
            unresolved += 1
            if len(unresolved_sample) < 20:
                unresolved_sample.append(loc)
            continue
        iso, name, continent = res
        cell = data[year][iso]
        cell['incidents'] += 1
        cell['fatalities'] += fat
        cell['name'] = name
        cell['continent'] = continent
        resolved += 1

    out = []
    for year in sorted(data.keys()):
        for iso, cell in data[year].items():
            out.append({
                'year': year,
                'iso': iso,
                'name': cell['name'],
                'continent': cell['continent'],
                'incidents': cell['incidents'],
                'fatalities': int(cell['fatalities']),
            })

    dest = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'data',
                        'crashes_by_country.json')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)

    pct = resolved / (resolved + unresolved) * 100
    print(f'Resolved: {resolved}   Unresolved: {unresolved}   ({pct:.1f}%)')
    print(f'Written {len(out)} records -> {dest}')


if __name__ == '__main__':
    main()
