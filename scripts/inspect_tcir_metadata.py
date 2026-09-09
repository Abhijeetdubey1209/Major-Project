import h5py
import numpy as np
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
file_path = ROOT / "data" / "tcir" / "TCIR-CPAC_IO_SH.h5"


def decode(value):
    """
    Convert bytes into normal Python strings.
    """

    if isinstance(value, bytes):
        return value.decode("utf-8")

    return value


print("=" * 70)
print("TCIR METADATA INSPECTION")
print("=" * 70)


with h5py.File(file_path, "r") as f:

    info = f["info"]

    print("\n📌 METADATA COLUMNS (axis0)")

    axis0 = info["axis0"][:]

    for i, value in enumerate(axis0):
        print(f"{i}: {decode(value)}")


    print("\n" + "=" * 70)
    print("NUMERIC COLUMNS")
    print("=" * 70)

    numeric_columns = [
        decode(x)
        for x in info["block0_items"][:]
    ]

    print(numeric_columns)


    print("\n" + "=" * 70)
    print("NON-NUMERIC COLUMNS")
    print("=" * 70)

    object_columns = [
        decode(x)
        for x in info["block1_items"][:]
    ]

    print(object_columns)


    print("\n" + "=" * 70)
    print("NUMERIC DATA SHAPE")
    print("=" * 70)

    numeric_values = info["block0_values"]

    print(numeric_values.shape)


    print("\nFirst 10 numeric rows:\n")

    sample_rows = numeric_values[:10]

    for i, row in enumerate(sample_rows):

        print(f"Sample {i}")

        for column, value in zip(numeric_columns, row):
            print(f"  {column}: {value}")

        print()


    print("=" * 70)
    print("OBJECT DATA STRUCTURE")
    print("=" * 70)

    object_values = info["block1_values"]

    print(f"Shape: {object_values.shape}")
    print(f"Dtype: {object_values.dtype}")

    print("\nRaw object value:")

    try:

        print(object_values[0])

    except Exception as e:

        print(f"Could not read object data directly: {e}")


print("\n" + "=" * 70)
print("METADATA INSPECTION COMPLETE")
print("=" * 70)