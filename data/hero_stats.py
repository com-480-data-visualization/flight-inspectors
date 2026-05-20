"""
Hero section stats — summary analysis of crashes_cleaned.csv

Key figures used in the hero section:
  - Total incidents (civil, excluding military/private/air-taxi): 5,078
  - Civil fatalities: 93,197
  - Military fatalities: 19,463  (total with military: 112,660)
  - Survival rate (civil): ~28.5%
  - Peak decade for incidents: 1960s
  - Unique operators (civil): ~1,960
  - Year span: 1908–2024
"""

import csv
import os
from collections import defaultdict

MILITARY_OPS = {'military', 'private', 'air taxi', '?', 'us aerial mail service', 'aeropostale'}

rows = list(csv.DictReader(open(
    os.path.join(os.path.dirname(__file__), 'crashes_cleaned.csv')
)))

total_incidents = 0
total_fatalities = 0
civil_incidents = 0
civil_fatalities = 0
mil_incidents = 0
mil_fatalities = 0
civil_aboard = 0
decade_counts = defaultdict(int)
operators = set()
years = []

for r in rows:
    op = r['Operator'].strip().lower()
    try:
        fat   = float(r['Fatalities']) if r['Fatalities'] else 0
        aboar = float(r['Aboard'])     if r['Aboard']     else 0
        y     = int(r['Year'])         if r['Year']       else None
    except (ValueError, KeyError):
        continue

    total_incidents   += 1
    total_fatalities  += fat

    is_mil = op in MILITARY_OPS or not op
    if is_mil:
        mil_incidents  += 1
        mil_fatalities += fat
    else:
        civil_incidents  += 1
        civil_fatalities += fat
        civil_aboard     += aboar
        operators.add(op)
        if y:
            decade_counts[(y // 10) * 10] += 1
            years.append(y)

survived_civil = civil_aboard - civil_fatalities
survival_rate  = survived_civil / civil_aboard * 100 if civil_aboard else 0

peak_decade = max(decade_counts, key=decade_counts.get)

print("=== Hero Stats ===")
print(f"Total incidents (all):          {total_incidents:,}")
print(f"Total fatalities (all):         {int(total_fatalities):,}")
print(f"Civil incidents:                {civil_incidents:,}")
print(f"Civil fatalities:               {int(civil_fatalities):,}")
print(f"Military/excluded incidents:    {mil_incidents:,}")
print(f"Military/excluded fatalities:   {int(mil_fatalities):,}")
print(f"Civil aboard (total):           {int(civil_aboard):,}")
print(f"Survival rate (civil):          {survival_rate:.1f}%")
print(f"Peak decade for incidents:      {peak_decade}s ({decade_counts[peak_decade]} incidents)")
print(f"Unique civil operators:         {len(operators):,}")
print(f"Year span:                      {min(years)}–{max(years)}")
print()
print("Top 5 decades by incident count:")
for dec, cnt in sorted(decade_counts.items(), key=lambda x: -x[1])[:5]:
    print(f"  {dec}s: {cnt} incidents")
