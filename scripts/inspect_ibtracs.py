import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
file_path = ROOT / "data" / "ibtracs" / "ibtracs.NI.list.v04r01.csv"

print("=" * 70)
print("IBTRACS DATASET INSPECTION")
print("=" * 70)

print("\n📂 Loading dataset...")

# IBTrACS CSV has metadata in the first row,
# so we load it normally first to inspect it.
df = pd.read_csv(file_path, low_memory=False)

print(f"\n✅ Dataset loaded successfully!")
print(f"\nShape: {df.shape}")

print("\n" + "=" * 70)
print("FIRST 5 ROWS")
print("=" * 70)

print(df.head())

print("\n" + "=" * 70)
print("NUMBER OF COLUMNS")
print("=" * 70)

print(len(df.columns))

print("\n" + "=" * 70)
print("FIRST 50 COLUMN NAMES")
print("=" * 70)

for i, column in enumerate(df.columns[:50]):
    print(f"{i}: {column}")

print("\n" + "=" * 70)
print("LOOKING FOR IMPORTANT CYCLONE COLUMNS")
print("=" * 70)

keywords = [
    "NAME",
    "ISO_TIME",
    "LAT",
    "LON",
    "USA_WIND",
    "USA_PRES",
    "WMO_WIND",
    "WMO_PRES",
    "SID",
    "SEASON",
    "BASIN"
]

for keyword in keywords:
    matches = [
        column for column in df.columns
        if keyword.lower() in column.lower()
    ]

    print(f"\n🔍 {keyword}:")
    for column in matches:
        print(f"   • {column}")

print("\n" + "=" * 70)
print("DATA TYPES")
print("=" * 70)

print(df.dtypes.head(30))

print("\n" + "=" * 70)
print("INSPECTION COMPLETE")
print("=" * 70)