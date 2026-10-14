// Shared in-page helper source (horizontal clipping only; the list scrolls vertically): true when the whole text of `el` is inside every clipping ancestor (overflow not visible) up to .result-container.
export const FULLY_VISIBLE = `(el) => {
	const range = document.createRange(); range.selectNodeContents(el);
	const t = range.getBoundingClientRect();
	if (!(t.width > 0 && t.height > 0)) return false;
	for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
		const cs = getComputedStyle(p);
		if (p !== el && (cs.overflowX !== "visible" || cs.overflowY !== "visible")) {
			const r = p.getBoundingClientRect();
			if (t.left < r.left - 0.5 || t.right > r.right + 0.5) return false;
		}
		if (p.classList && p.classList.contains("result-container")) break;
	}
	return true;
}`;
