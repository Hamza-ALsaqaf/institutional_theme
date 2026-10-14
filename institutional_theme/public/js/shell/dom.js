// Small shared helpers. No core class is touched.
export function toElement(value) {
	if (!value) return null;
	if (value.nodeType === 1) return value;
	return value[0] && value[0].nodeType === 1 ? value[0] : null;
}

// Writes an attribute only when the value changes; null or undefined removes it.
export function setAttr(element, name, value) {
	if (!element) return;
	if (value === null || value === undefined) {
		if (element.hasAttribute(name)) element.removeAttribute(name);
	} else if (element.getAttribute(name) !== value) {
		element.setAttribute(name, value);
	}
}

export function warn(scope, error) {
	if (window.console && console.warn) console.warn("Institutional Theme: " + scope, error);
}

// Runs `run` once, soon: on the next animation frame while the tab is visible, on a timer while it is hidden
// (browsers pause animation frames in background tabs, so callers that queue work would hold on to it until the
// tab returns). A one-second timer backs up the frame for a tab that is hidden after the frame was requested.
export function defer(run) {
	if (document.hidden || typeof requestAnimationFrame !== "function") {
		setTimeout(run, document.hidden ? 250 : 16);
		return;
	}
	let done = false;
	let timer = 0;
	const once = () => {
		if (done) return;
		done = true;
		clearTimeout(timer);
		run();
	};
	requestAnimationFrame(once);
	timer = setTimeout(once, 1000);
}
