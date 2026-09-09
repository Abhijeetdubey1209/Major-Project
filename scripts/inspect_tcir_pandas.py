import pandas as pd
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
file_path = ROOT / "data" / "tcir" / "TCIR-CPAC_IO_SH.h5"


print("=" * 70)
print("TCIR PANDAS INSPECTION")
print("=" * 70)


print("\n📂 Opening HDF5 file using Pandas...")

try:

    # Show all available keys
    with pd.HDFStore(file_path, mode="r") as store:

        print("\nAvailable HDF5 keys:")

        keys = store.keys()

        for key in keys:
            print(f"  {key}")

        print("\nHDF5 structure:")
        print(store)


    print("\n" + "=" * 70)
    print("LOADING INFO METADATA")
    print("=" * 70)


    info = pd.read_hdf(
        file_path,
        key="info"
    )


    print("\n✅ Metadata loaded successfully!")

    print("\nShape:")
    print(info.shape)


    print("\nColumns:")

    for column in info.columns:
        print(f"  • {column}")


    print("\n" + "=" * 70)
    print("FIRST 10 ROWS")
    print("=" * 70)

    print(info.head(10))


    print("\n" + "=" * 70)
    print("DATA TYPES")
    print("=" * 70)

    print(info.dtypes)


    print("\n" + "=" * 70)
    print("DATASET / BASIN DISTRIBUTION")
    print("=" * 70)

    print(info["data_set"].value_counts())


    print("\n" + "=" * 70)
    print("NUMBER OF UNIQUE CYCLONES")
    print("=" * 70)

    print(info["ID"].nunique())


    print("\nUnique IDs by dataset:")

    print(
        info.groupby("data_set")["ID"]
        .nunique()
        .sort_values(ascending=False)
    )


    print("\n" + "=" * 70)
    print("SAMPLE CYCLONE IDs")
    print("=" * 70)

    print(info["ID"].unique()[:20])


    print("\n" + "=" * 70)
    print("TIME RANGE")
    print("=" * 70)

    print("First timestamp:")
    print(info["time"].min())

    print("\nLast timestamp:")
    print(info["time"].max())


    print("\n" + "=" * 70)
    print("WIND SPEED STATISTICS")
    print("=" * 70)

    print(
        info["Vmax"].describe()
    )


    print("\n" + "=" * 70)
    print("PRESSURE STATISTICS")
    print("=" * 70)

    print(
        info["MSLP"].describe()
    )


    print("\n" + "=" * 70)
    print("INSPECTION COMPLETE")
    print("=" * 70)


except Exception as e:

    print("\n❌ ERROR OCCURRED")

    print(type(e).__name__)
    print(e)
    