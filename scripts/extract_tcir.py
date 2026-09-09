import tarfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
archive_path = ROOT / "TCIR-CPAC_IO_SH.h5.tar.gz"
extract_path = ROOT / "data" / "tcir"


print("Checking archive...")

if not archive_path.exists():
    print(f"❌ Archive not found: {archive_path}")
    raise SystemExit


print(f"✅ Archive found: {archive_path}")
print(f"📦 Archive size: {archive_path.stat().st_size / (1024 ** 3):.2f} GB")


# Create extraction directory
extract_path.mkdir(exist_ok=True)


print("\n🚀 Starting extraction...")
print("⏳ This can take several minutes.")
print("Please don't close the terminal or press Ctrl+C.")


with tarfile.open(archive_path, "r:gz") as tar:

    # Extract directly without calling getmembers()
    for member in tar:

        print(f"Extracting: {member.name}")

        tar.extract(member, path=extract_path)


print("\n✅ Extraction completed successfully!")


print("\n📂 Extracted files:")

for file in extract_path.iterdir():

    print(file.name)

    if file.is_file():
        size_gb = file.stat().st_size / (1024 ** 3)
        print(f"   Size: {size_gb:.2f} GB")