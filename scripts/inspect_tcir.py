import h5py
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
file_path = ROOT / "data" / "tcir" / "TCIR-CPAC_IO_SH.h5"


print("=" * 60)
print("TCIR DATASET INSPECTION")
print("=" * 60)


if not file_path.exists():
    print(f"❌ File not found: {file_path}")
    raise SystemExit


print(f"\n✅ File found: {file_path}")

size_gb = file_path.stat().st_size / (1024 ** 3)

print(f"📦 File size: {size_gb:.2f} GB")


with h5py.File(file_path, "r") as f:

    print("\n" + "=" * 60)
    print("ROOT KEYS")
    print("=" * 60)

    for key in f.keys():
        print(f"\n📁 {key}")

        item = f[key]

        if isinstance(item, h5py.Dataset):
            print(f"   Type: Dataset")
            print(f"   Shape: {item.shape}")
            print(f"   Data type: {item.dtype}")

        elif isinstance(item, h5py.Group):
            print(f"   Type: Group")

            for subkey in item.keys():
                subitem = item[subkey]

                print(f"\n   └── {subkey}")

                if isinstance(subitem, h5py.Dataset):
                    print(f"       Shape: {subitem.shape}")
                    print(f"       Data type: {subitem.dtype}")


print("\n" + "=" * 60)
print("INSPECTION COMPLETE")
print("=" * 60)