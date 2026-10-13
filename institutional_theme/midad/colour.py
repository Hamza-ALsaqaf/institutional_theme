"""Colour maths: the port of design/reference/color.mjs, which remains the specification.

OKLCH is the design space. Everything shipped to browsers is precomputed sRGB hex. The function
order, constants, tolerances and rounding below follow color.mjs line by line, because the port
must reproduce every hex of design/reference/tokens.resolved.json exactly.
"""

from __future__ import annotations

import math
import re
from typing import NamedTuple

Vec3 = tuple[float, float, float]


class Oklch(NamedTuple):
	"""A colour in OKLab polar form; `a` and `b` are the Cartesian chroma axes."""

	lightness: float
	c: float
	h: float
	a: float
	b: float


class Gamut(NamedTuple):
	"""Result of `oklch_to_hex`: the hex, whether chroma was reduced, and the chroma used."""

	hex: str
	clipped: bool
	c: float


_HEX_RE = re.compile(r"^[0-9a-fA-F]{6}$")


def _round_half_up(x: float) -> int:
	"""JavaScript `Math.round` for non-negative input (Python's round() is banker's rounding)."""
	return math.floor(x + 0.5)


def _clamp01(x: float) -> float:
	return min(1.0, max(0.0, x))


def encode(c: float) -> float:
	"""sRGB transfer function, linear to gamma encoded (0..1)."""
	if c <= 0.0031308:
		return 12.92 * c
	return 1.055 * c ** (1 / 2.4) - 0.055


def decode(c: float) -> float:
	"""sRGB transfer function, gamma encoded (0..1) to linear."""
	if c <= 0.04045:
		return c / 12.92
	return ((c + 0.055) / 1.055) ** 2.4


def oklch_to_linear(lightness: float, chroma: float, hue: float) -> Vec3:
	"""OKLCH (L 0..1, C, H degrees) to a linear sRGB triplet, possibly out of gamut."""
	h = hue * math.pi / 180
	a = chroma * math.cos(h)
	b = chroma * math.sin(h)
	l_ = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
	m_ = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
	s_ = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
	return (
		4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
		-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
		-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
	)


def _in_gamut(rgb: Vec3) -> bool:
	return all(-0.0005 <= c <= 1.0005 for c in rgb)


def linear_to_hex(lin: Vec3) -> str:
	"""Linear sRGB to `#rrggbb`, clamping each channel."""
	return "#" + "".join(f"{_round_half_up(_clamp01(encode(_clamp01(c))) * 255):02x}" for c in lin)


def oklch_to_hex(lightness: float, chroma: float, hue: float) -> Gamut:
	"""OKLCH to sRGB hex.

	An out-of-gamut colour keeps its lightness and hue and loses chroma (24-step binary search),
	so ramps stay perceptually even.
	"""
	lin = oklch_to_linear(lightness, chroma, hue)
	used = chroma
	clipped = False
	if not _in_gamut(lin):
		clipped = True
		lo = 0.0
		hi = chroma
		for _ in range(24):
			mid = (lo + hi) / 2
			if _in_gamut(oklch_to_linear(lightness, mid, hue)):
				lo = mid
			else:
				hi = mid
		used = lo
		lin = oklch_to_linear(lightness, used, hue)
	return Gamut(linear_to_hex(lin), clipped, used)


def hex_to_rgb(value: str) -> tuple[int, int, int]:
	"""`#rgb` or `#rrggbb` (the `#` is optional) to integers 0..255. Raises ValueError otherwise."""
	h = value.replace("#", "").strip()
	if len(h) == 3:
		h = "".join(x + x for x in h)
	if not _HEX_RE.match(h):
		raise ValueError(f"Not a hex colour: {value}")
	return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def hex_to_linear(value: str) -> Vec3:
	"""sRGB hex to a linear sRGB triplet."""
	r, g, b = hex_to_rgb(value)
	return (decode(r / 255), decode(g / 255), decode(b / 255))


def hex_to_oklch(value: str) -> Oklch:
	"""sRGB hex to OKLCH. Used to derive a brand ramp from a supplied hex."""
	r, g, b = hex_to_linear(value)
	l_ = math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
	m_ = math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
	s_ = math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
	lightness = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
	a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
	b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
	h = math.atan2(b_, a) * 180 / math.pi
	if h < 0:
		h += 360
	return Oklch(lightness, math.hypot(a, b_), h, a, b_)


def luminance(value: str) -> float:
	"""WCAG 2.x relative luminance of an sRGB hex."""
	r, g, b = hex_to_linear(value)
	return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
	"""WCAG 2.x contrast ratio between two opaque sRGB hex colours."""
	la = luminance(a)
	lb = luminance(b)
	return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def composite(fg: str, alpha: float, bg: str) -> str:
	"""Composite a translucent colour over an opaque background in gamma space, as browsers do."""
	f = hex_to_rgb(fg)
	b = hex_to_rgb(bg)
	return "#" + "".join(f"{_round_half_up(f[i] * alpha + b[i] * (1 - alpha)):02x}" for i in range(3))


def format_number(x: float) -> str:
	"""Shortest decimal text of a number, as JavaScript prints it (`0.45`, `1`, never `1.0`)."""
	text = repr(float(x))
	if text.endswith(".0"):
		text = text[:-2]
	return text


def rgba(value: str, alpha: float) -> str:
	"""`rgba(r, g, b, a)` text for a hex colour and an alpha."""
	r, g, b = hex_to_rgb(value)
	return f"rgba({r}, {g}, {b}, {format_number(alpha)})"


# Colour-vision-deficiency simulation, Machado, Oliveira & Fernandes (2009), severity 1.0.
# The matrices operate on linear RGB.
CVD: dict[str, tuple[Vec3, Vec3, Vec3]] = {
	"protanopia": (
		(0.152286, 1.052583, -0.204868),
		(0.114503, 0.786281, 0.099216),
		(-0.003882, -0.048116, 1.051998),
	),
	"deuteranopia": (
		(0.367322, 0.860646, -0.227968),
		(0.280085, 0.672501, 0.047413),
		(-0.01182, 0.04294, 0.968881),
	),
	"tritanopia": (
		(1.255528, -0.076749, -0.178779),
		(-0.078411, 0.930809, 0.147602),
		(0.004733, 0.691367, 0.3039),
	),
}

CVD_TYPES: tuple[str, ...] = tuple(CVD)


def simulate(value: str, kind: str) -> str:
	"""Hex as it appears under a colour-vision deficiency (`CVD_TYPES`) or `"grayscale"`."""
	lin = hex_to_linear(value)
	if kind == "grayscale":
		y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
		return linear_to_hex((y, y, y))
	matrix = CVD.get(kind)
	if matrix is None:
		raise ValueError(f"Unknown simulation: {kind}")
	return linear_to_hex(
		tuple(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2] for row in matrix)  # type: ignore[arg-type]
	)


def delta_e(a: str, b: str) -> float:
	"""Perceptual distance between two hex colours: Euclidean distance in OKLab, scaled by 100."""
	x = hex_to_oklch(a)
	y = hex_to_oklch(b)
	return 100 * math.hypot(x.lightness - y.lightness, x.a - y.a, x.b - y.b)
