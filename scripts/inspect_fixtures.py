import glob
import os
import sys
import xarray as xr

def inspect_all():
    fixture_dir = os.path.join(os.path.dirname(__file__), "..", "data", "dev_fixtures")
    files = glob.glob(os.path.join(fixture_dir, "*.nc"))
    if not files:
        # Fallback to dataset/training
        fixture_dir = os.path.join(os.path.dirname(__file__), "..", "dataset", "training")
        files = glob.glob(os.path.join(fixture_dir, "*.nc"))
    
    print(f"Found {len(files)} NetCDF fixtures in {fixture_dir}:")
    for f in sorted(files):
        fname = os.path.basename(f)
        print(f"\n==========================================")
        print(f"File: {fname}")
        print(f"Size: {os.path.getsize(f) / (1024*1024):.2f} MB")
        try:
            ds = xr.open_dataset(f)
            print(f"Dimensions: {dict(ds.dims)}")
            print("Variables:")
            for v in ds.data_vars:
                var = ds[v]
                units = var.attrs.get("units", "N/A")
                long_name = var.attrs.get("long_name", "")
                print(f"  - {v}: shape={var.shape}, dtype={var.dtype}, units='{units}', desc='{long_name}'")
            coords = {}
            for c in ds.coords:
                coord = ds[c]
                if "lat" in c.lower() or "lon" in c.lower() or "depth" in c.lower() or "time" in c.lower():
                    try:
                        coords[c] = (float(coord.min()), float(coord.max()), len(coord))
                    except Exception:
                        coords[c] = f"len={len(coord)}"
            print(f"Coordinates summary: {coords}")
            ds.close()
        except Exception as e:
            print(f"Error reading {fname}: {e}")

if __name__ == "__main__":
    inspect_all()
