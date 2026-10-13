"""Approved-design deviations of ADR 0010, in one place.

`design/reference/tokens.resolved.json` stays the approved record and is never edited. A test
asserts equality with it for every key except those listed here, which it asserts equal to the
new values. Keys are `(mode, semantic token)`; values are the resolved hex of the `midad` preset.
Source: docs/adr/0010-contrast-corrections-phase2.md, "Design deviations".
"""

from __future__ import annotations

ADR = "docs/adr/0010-contrast-corrections-phase2.md"

# Semantic tokens whose resolved hex differs from the approved fixture, with the new hex.
SEMANTIC: dict[tuple[str, str], str] = {
	("dark", "surface-selected-strong"): "#1d3958",  # oklch(0.34 0.065 252); approved #1f3c5b
	("light", "chart-2"): "#a76fc7",  # purple.500; approved amber.700 #885700
	("dark", "chart-2"): "#c392e1",  # purple.400; approved amber.500 #dc9322
	("light", "chart-4"): "#885700",  # amber.700; approved red.800 #741417
	("dark", "chart-4"): "#dc9322",  # amber.500; approved red.400 #fb7e77
	("light", "chart-5"): "#d06b26",  # orange.500; approved purple.500 #a76fc7
	("dark", "chart-5"): "#ae5000",  # orange.600; approved purple.400 #c392e1
	("light", "chart-6"): "#741417",  # red.800; approved orange.500 #d06b26
	("dark", "chart-6"): "#fb7e77",  # red.400; approved orange.600 #ae5000
}


def expected(fixture: dict, mode: str, name: str) -> str:
	"""The value the port must produce for a semantic token: the deviation, else the fixture."""
	return SEMANTIC.get((mode, name), fixture["sem"][mode][name])
