import json
from pathlib import Path

rules = json.loads(Path("firebase-config.js").read_text(encoding="utf-8"))
assert rules == {"rules": {".read": False, ".write": False}}, (
    "Emergency database policy must remain fail-closed until trusted server-side "
    "authorization and narrowly scoped rules have been implemented."
)
print("PASS — Realtime Database rules deny all client reads and writes")
