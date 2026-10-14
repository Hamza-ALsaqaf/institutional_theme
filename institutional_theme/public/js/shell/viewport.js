// Lets the user zoom the desk (WCAG 1.4.4 Resize Text, 1.4.10 Reflow; BRIEF priority 2). Core's desk page declares
//   <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0,
//         user-scalable=no, minimal-ui">
// (frappe/www/desk.html:14-15), which stops pinch-zoom on touch devices. Lead decision (round 3): the shell script
// removes `maximum-scale`, `minimum-scale` and `user-scalable` from the `content` attribute and keeps every other
// entry (`width=device-width`, `initial-scale=1.0`, `minimal-ui`). One attribute write on an existing node, made
// once; nothing is added, and a page whose meta already allows zoom is not touched.
const BLOCKING = /^(maximum-scale|minimum-scale|user-scalable)$/i;

export function relaxedViewport(content) {
	return String(content || "")
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part && !BLOCKING.test(part.split("=")[0].trim()))
		.join(", ");
}

export function initViewport() {
	const meta = document.querySelector("meta[name='viewport']");
	if (!meta) return;
	const before = meta.getAttribute("content") || "";
	const after = relaxedViewport(before);
	if (after && after !== before) meta.setAttribute("content", after);
}
