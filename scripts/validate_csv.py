#!/usr/bin/env python3
"""
Validate experts.csv before ingestion.

Run: python scripts/validate_csv.py [path/to/experts.csv]
     Default path: data/experts.csv
"""
import sys
from pathlib import Path

import pandas as pd


def detect_encoding(path: Path) -> str:
    try:
        import chardet
        raw = path.read_bytes()
        result = chardet.detect(raw[:10000])
        return result.get("encoding", "utf-8") or "utf-8"
    except ImportError:
        return "utf-8"


def load_csv(path: Path) -> pd.DataFrame:
    try:
        return pd.read_csv(path, encoding="utf-8-sig")
    except UnicodeDecodeError:
        enc = detect_encoding(path)
        print(f"[warn] UTF-8 decode failed; retrying with detected encoding: {enc}")
        return pd.read_csv(path, encoding=enc)


def validate(csv_path: Path) -> bool:
    if not csv_path.exists():
        print(f"[error] File not found: {csv_path}")
        return False

    df = load_csv(csv_path)

    print("=" * 60)
    print("CSV DISCOVERY REPORT")
    print("=" * 60)
    print(f"Rows: {len(df)}")
    print(f"Columns ({len(df.columns)}): {list(df.columns)}")
    print()
    print("Sample (first 3 rows):")
    for i, row in df.head(3).iterrows():
        print(f"  Row {i}: {row.to_dict()}")
    print()

    cols_lower = {c.lower(): c for c in df.columns}

    # --- Data quality checks ---
    warnings = []
    errors = []

    # Check for URL column
    url_candidates = [c for c in cols_lower if "url" in c or "link" in c or "profile" in c]
    if url_candidates:
        url_col = cols_lower[url_candidates[0]]
        null_urls = df[url_col].isna().sum()
        empty_urls = (df[url_col].astype(str).str.strip() == "").sum()
        bad_urls = null_urls + empty_urls
        if bad_urls > 0:
            warnings.append(f"URL column '{url_col}': {bad_urls} empty/null values")
    else:
        errors.append("No URL column detected (expected column containing 'url', 'link', or 'profile')")

    # Check for name column
    name_candidates = [c for c in cols_lower if "name" in c]
    if name_candidates:
        name_col = cols_lower[name_candidates[0]]
        null_names = df[name_col].isna().sum()
        if null_names > 0:
            warnings.append(f"Name column '{name_col}': {null_names} null values")
    else:
        errors.append("No name column detected (expected column containing 'name')")

    # Check for bio/description column
    bio_candidates = [c for c in cols_lower if any(k in c for k in ("bio", "description", "about", "summary"))]
    if bio_candidates:
        bio_col = cols_lower[bio_candidates[0]]
        empty_bios = df[bio_col].isna().sum() + (df[bio_col].astype(str).str.strip() == "").sum()
        if empty_bios > 0:
            warnings.append(f"Bio column '{bio_col}': {empty_bios} empty/null (retrieval quality may degrade)")
    else:
        warnings.append("No bio/description column detected — embedding text will be title + company only")

    # Check for rate column
    rate_candidates = [c for c in cols_lower if any(k in c for k in ("rate", "price", "cost", "fee"))]
    if not rate_candidates:
        warnings.append("No rate/price column detected — hourly rate will not be available in cards")

    # --- Report ---
    if warnings:
        print("WARNINGS:")
        for w in warnings:
            print(f"  [warn] {w}")
        print()

    if errors:
        print("ERRORS (critical — fix before running ingest.py):")
        for e in errors:
            print(f"  [error] {e}")
        print()
        return False

    print("STATUS: CSV is valid — ready for ingest.py")
    print()
    print("NEXT STEP: Update field names in scripts/ingest.py to match columns above.")
    return True


if __name__ == "__main__":
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/experts.csv")
    success = validate(csv_path)
    sys.exit(0 if success else 1)
