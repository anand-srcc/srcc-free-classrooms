import json

with open(r'web_app\srcc_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

rooms = data['rooms']
days = data['metadata']['days']

print(f"Total Rooms Analyzed: {len(rooms)}")

# Stats per day
print("\n" + "="*70)
print("  TOTAL FREE SLOTS ACROSS ALL 96 ROOMS BY DAY")
print("="*70)
for d in days:
    total_free = sum(r['schedule'][d]['free_hours'] for r in rooms)
    fully_free = sum(1 for r in rooms if r['schedule'][d]['free_hours'] == 9)
    partial = sum(1 for r in rooms if 0 < r['schedule'][d]['free_hours'] < 9)
    busy = sum(1 for r in rooms if r['schedule'][d]['free_hours'] == 0)
    print(f"{d:10}: {total_free:>4} total free hours | {fully_free:>2} rooms 100% free all day | {partial:>2} rooms partially free | {busy:>2} completely packed")

# Category grouping
categories = {}
for r in rooms:
    categories.setdefault(r['category'], []).append(r)

print("\n" + "="*70)
print("  CATEGORY-WISE ROOM HIGHLIGHTS & FREE TIMINGS")
print("="*70)

for cat_name, rlist in categories.items():
    print(f"\n[{cat_name.upper()}] ({len(rlist)} Rooms)")
    sample_rooms = rlist[:7] if len(rlist) > 7 else rlist
    for r in sample_rooms:
        mon = r['schedule']['Monday']
        tue = r['schedule']['Tuesday']
        wed = r['schedule']['Wednesday']
        thu = r['schedule']['Thursday']
        fri = r['schedule']['Friday']
        sat = r['schedule']['Saturday']
        
        free_timings_mon = mon['free_slots']
        if len(free_timings_mon) == 9:
            mon_str = "ALL DAY FREE (8:30 AM - 6:00 PM)"
        elif len(free_timings_mon) == 0:
            mon_str = "No Free Slot (Packed)"
        else:
            short_slots = [s.replace(' to ', '–').replace(' AM', '').replace(' PM', '') for s in free_timings_mon]
            mon_str = f"{mon['free_hours']}h free ({', '.join(short_slots[:3])}{'...' if len(short_slots)>3 else ''})"
            
        print(f"  • {r['code']:<6} ({r['name'][:22]:<22}): Mon: {mon_str} | Sat: {sat['free_hours']}h free")
