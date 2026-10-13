// Density attribute, set while the bundle is evaluated, before the desk is built
// (ADR 0003). Without boot data nothing is written and the stylesheet default applies.
export function initDensity() {
	const boot = window.frappe && frappe.boot;
	const ins = boot && boot.ins;
	if (!ins || !ins.density) return;
	const density = ins.density === "compact" ? "compact" : "comfortable";
	if (document.documentElement.getAttribute("data-ins-density") !== density) {
		document.documentElement.setAttribute("data-ins-density", density);
	}
}
