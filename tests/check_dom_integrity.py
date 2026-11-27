from html.parser import HTMLParser
from pathlib import Path
import re

class IdCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name == "id" and value:
                self.ids.append(value)

html = Path("index.html").read_text(encoding="utf-8")
parser = IdCollector()
parser.feed(html)

seen = set()
duplicates = sorted({value for value in parser.ids if value in seen or seen.add(value)})
if duplicates:
    raise SystemExit("Duplicate HTML IDs: " + ", ".join(duplicates))

defined = set(parser.ids)
patterns = (
    r"\$\(\s*(['\"])(.*?)\1\s*\)",
    r"document\.getElementById\(\s*(['\"])(.*?)\1\s*\)",
)
references = set()
for pattern in patterns:
    references.update(match.group(2) for match in re.finditer(pattern, html))

missing = sorted(references - defined)
if missing:
    raise SystemExit("JavaScript references missing HTML IDs: " + ", ".join(missing))

print(f"DOM integrity passed: {len(defined)} unique IDs, {len(references)} literal references, no missing IDs.")
