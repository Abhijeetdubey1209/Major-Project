import xarray as xr
from pathlib import Path

print("=" * 70)
print("ERA5 DATASET INSPECTION")
print("=" * 70)

ROOT = Path(__file__).resolve().parent.parent
file_path = ROOT / "data" / "era5" / "data_stream-oper_stepType-instant.nc"

if not file_path.exists():
    print(f"\n❌ File not found: {file_path}")
    print(f"\nCurrent working directory: {Path.cwd()}")
    exit()

print(f"\n✅ File found: {file_path}")
print(f"📦 File size: {file_path.stat().st_size / (1024 * 1024):.2f} MB")

print("\n⏳ Opening NetCDF file...")

try:
    ds = xr.open_dataset(file_path)

    print("\n" + "=" * 70)
    print("DATASET OVERVIEW")
    print("=" * 70)

    print(ds)

    print("\n" + "=" * 70)
    print("VARIABLES")
    print("=" * 70)

    for variable in ds.data_vars:
        data = ds[variable]

        print(f"\n📊 {variable}")
        print(f"   Dimensions: {data.dims}")
        print(f"   Shape: {data.shape}")
        print(f"   Units: {data.attrs.get('units', 'Unknown')}")
        print(f"   Description: {data.attrs.get('long_name', 'Unknown')}")

    print("\n" + "=" * 70)
    print("COORDINATES")
    print("=" * 70)

    for coordinate in ds.coords:
        values = ds[coordinate]

        print(f"\n📍 {coordinate}")
        print(f"   Shape: {values.shape}")

        if values.size > 0:
            print(f"   First: {values.values.flat[0]}")
            print(f"   Last: {values.values.flat[-1]}")

    print("\n" + "=" * 70)
    print("DIMENSIONS")
    print("=" * 70)

    for dimension, size in ds.sizes.items():
        print(f"   {dimension}: {size}")

    print("\n" + "=" * 70)
    print("GLOBAL ATTRIBUTES")
    print("=" * 70)

    for key, value in ds.attrs.items():
        print(f"{key}: {value}")

    print("\n" + "=" * 70)
    print("INSPECTION COMPLETE")
    print("=" * 70)

    ds.close()

except Exception as e:
    print("\n❌ Error opening ERA5 file:")
    print(type(e).__name__)
    print(e)