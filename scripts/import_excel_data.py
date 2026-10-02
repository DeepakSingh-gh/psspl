"""Import supplied PSSPL workbooks into local CRM SQLite database."""
import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
script = ROOT / "scripts" / "import_psspldata.py"

args = [sys.executable, str(script)] + sys.argv[1:]
res = subprocess.run(args)
sys.exit(res.returncode)

