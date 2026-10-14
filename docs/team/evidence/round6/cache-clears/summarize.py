"""Markdown table of the kept run logs: python3 summarize.py > table.md"""

import pathlib
import re

here = pathlib.Path(__file__).parent / "logs"
rows = []
for path in sorted(here.glob("run-*.log"), key=lambda p: (p.name.split("-")[1:-1], int(p.stem.rsplit("-", 1)[1]))):
	text = path.read_text(errors="replace")
	ran = re.findall(r"^Ran (\d+) tests in ([\d.]+)s", text, re.M)
	verdict = re.findall(r"^(OK|FAILED[^\n]*)$", text, re.M)
	failed = re.findall(r"^ (?:FAIL|ERROR)\s+(\S+) \(", text, re.M)
	exit_code = re.findall(r"run-tests exit (\d+)", text)
	load = re.findall(r"^load: requests: (\d+); by status: (.*)$", text, re.M)
	label = path.stem.removeprefix("run-")
	integ = f"{ran[0][0]} ({ran[0][1]} s)" if ran else "-"
	unit = f"{ran[1][0]}" if len(ran) > 1 else "-"
	rows.append(
		f"| `{label}` | {integ} | {unit} | {', '.join(verdict) or '-'} | {exit_code[0] if exit_code else '-'} | "
		f"{load[0][0] if load else '-'} | {load[0][1] if load else '-'} | {', '.join(failed) or '-'} |"
	)
print("| Run | Integration tests | Unit tests | Verdicts | Exit | Load requests | Load status codes | Failed tests |")
print("|---|---|---|---|---|---|---|---|")
print("\n".join(rows))
