// Colour maths for the token pipeline and audits. Dependency-free (Node >= 18).
// OKLCH is the design space; everything shipped to browsers is precomputed sRGB.

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** sRGB transfer function, linear -> gamma encoded (0..1). */
function encode(c) {
	return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** sRGB transfer function, gamma encoded (0..1) -> linear. */
function decode(c) {
	return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** OKLCH (L 0..1, C, H degrees) -> linear sRGB triplet (may be out of gamut). */
export function oklchToLinear(L, C, H) {
	const h = (H * Math.PI) / 180;
	const a = C * Math.cos(h);
	const b = C * Math.sin(h);
	const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
	const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
	const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

const inGamut = (rgb) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);

/**
 * OKLCH -> sRGB hex. Out-of-gamut colours keep their lightness and hue and
 * lose chroma (binary search), so ramps stay perceptually even.
 * Returns { hex, clipped, c } where c is the chroma actually used.
 */
export function oklchToHex(L, C, H) {
	let lin = oklchToLinear(L, C, H);
	let used = C;
	let clipped = false;
	if (!inGamut(lin)) {
		clipped = true;
		let lo = 0;
		let hi = C;
		for (let i = 0; i < 24; i++) {
			const mid = (lo + hi) / 2;
			if (inGamut(oklchToLinear(L, mid, H))) lo = mid;
			else hi = mid;
		}
		used = lo;
		lin = oklchToLinear(L, used, H);
	}
	return { hex: linearToHex(lin), clipped, c: used };
}

export function linearToHex(lin) {
	return (
		"#" +
		lin
			.map((c) => Math.round(clamp01(encode(clamp01(c))) * 255))
			.map((v) => v.toString(16).padStart(2, "0"))
			.join("")
	);
}

/** "#rgb" | "#rrggbb" -> [r, g, b] in 0..255. */
export function hexToRgb(hex) {
	let h = hex.replace("#", "").trim();
	if (h.length === 3) h = [...h].map((x) => x + x).join("");
	if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Not a hex colour: ${hex}`);
	return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export const hexToLinear = (hex) => hexToRgb(hex).map((v) => decode(v / 255));

/** sRGB hex -> OKLCH { l, c, h }. Used to derive a brand ramp from a supplied hex. */
export function hexToOklch(hex) {
	const [r, g, b] = hexToLinear(hex);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
	const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
	const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
	let h = (Math.atan2(B, A) * 180) / Math.PI;
	if (h < 0) h += 360;
	return { l: L, c: Math.hypot(A, B), h, a: A, b: B };
}

/** WCAG 2.x relative luminance of an sRGB hex. */
export function luminance(hex) {
	const [r, g, b] = hexToLinear(hex);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two opaque sRGB hex colours. */
export function contrast(a, b) {
	const la = luminance(a);
	const lb = luminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Composite a translucent colour over an opaque background (gamma space, as browsers do). */
export function composite(fgHex, alpha, bgHex) {
	const f = hexToRgb(fgHex);
	const b = hexToRgb(bgHex);
	return (
		"#" +
		f
			.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)))
			.map((v) => v.toString(16).padStart(2, "0"))
			.join("")
	);
}

export function rgba(hex, alpha) {
	const [r, g, b] = hexToRgb(hex);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Colour-vision-deficiency simulation, Machado, Oliveira & Fernandes (2009), severity 1.0.
// Matrices operate on linear RGB.
const CVD = {
	protanopia: [
		[0.152286, 1.052583, -0.204868],
		[0.114503, 0.786281, 0.099216],
		[-0.003882, -0.048116, 1.051998],
	],
	deuteranopia: [
		[0.367322, 0.860646, -0.227968],
		[0.280085, 0.672501, 0.047413],
		[-0.01182, 0.04294, 0.968881],
	],
	tritanopia: [
		[1.255528, -0.076749, -0.178779],
		[-0.078411, 0.930809, 0.147602],
		[0.004733, 0.691367, 0.3039],
	],
};

export const CVD_TYPES = Object.keys(CVD);

/** Simulate how a hex colour appears under a colour-vision deficiency, or "grayscale". */
export function simulate(hex, type) {
	const lin = hexToLinear(hex);
	if (type === "grayscale") {
		const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
		return linearToHex([y, y, y]);
	}
	const m = CVD[type];
	if (!m) throw new Error(`Unknown simulation: ${type}`);
	return linearToHex(m.map((row) => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]));
}

/** Perceptual distance between two hex colours: Euclidean distance in OKLab, scaled x100. */
export function deltaE(a, b) {
	const x = hexToOklch(a);
	const y = hexToOklch(b);
	return 100 * Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b);
}
