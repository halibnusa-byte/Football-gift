from pathlib import Path

root = Path(__file__).resolve().parents[1]
intro = root / "assets" / "intro.mp4"
html = (root / "index.html").read_text(encoding="utf-8")

if not intro.is_file():
    raise SystemExit("Missing required intro video: assets/intro.mp4")
if intro.stat().st_size < 100_000:
    raise SystemExit("Intro video exists but is unexpectedly small; verify the uploaded file.")
if 'src="assets/intro.mp4"' not in html:
    raise SystemExit("index.html does not reference the required intro video path.")
if 'id="introVideo"' not in html or 'id="introStart"' not in html:
    raise SystemExit("Intro video or STARTEN control is missing from index.html.")

print(f"Media asset check passed: assets/intro.mp4 ({intro.stat().st_size:,} bytes).")
