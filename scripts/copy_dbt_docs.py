"""Copy the generated dbt docs into the built site at /docs/.
Run after `dbt docs generate` and `npm run build`. Fails if a file is missing,
so the deploy never ships a broken lineage page."""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = ["index.html", "manifest.json", "catalog.json"]


def main() -> int:
    src, dest = ROOT / "dbt" / "target", ROOT / "site" / "dist" / "docs"
    missing = [f for f in FILES if not (src / f).exists()]
    if missing:
        print(f"dbt docs missing in {src}: {', '.join(missing)}. Run dbt docs generate first.", file=sys.stderr)
        return 1
    if not (ROOT / "site" / "dist").exists():
        print("site/dist does not exist. Run npm run build first.", file=sys.stderr)
        return 1
    dest.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        shutil.copy2(src / f, dest / f)
    print(f"copied dbt docs to {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
