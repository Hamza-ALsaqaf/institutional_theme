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
