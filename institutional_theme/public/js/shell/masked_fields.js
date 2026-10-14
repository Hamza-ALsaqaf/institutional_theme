// Role-masked fields get a marker and a reason (ADR 0008, section 4). Core sends
// a placeholder value and forces the field read-only but leaves no markup
// (frappe/public/js/frappe/form/form.js:1214-1220). The reason is exposed as an
// attribute; CSS draws it as generated text.
//
// Core shows a read-only value as a static `.control-value` div and hides the input, so
// `aria-describedby` on the input reaches nobody. The static value therefore also gets
// `role="textbox"`, `aria-readonly`, a name from the field label and the same description, and
// `tabindex="0"` so a keyboard and a screen reader can reach it. Attributes only.
import { toElement, setAttr, warn } from "./dom.js";

const REASON_CLASS = "ins-masked-reason";
let counter = 0;

// The reason element of one wrapper: found again on every refresh, created once.
function reasonElement(wrapper) {
	for (const child of wrapper.children) {
		if (child.classList.contains(REASON_CLASS)) return child;
	}
	const node = document.createElement("span");
	node.className = REASON_CLASS;
	counter += 1;
	node.id = "ins-masked-reason-" + counter;
	wrapper.appendChild(node);
	return node;
}

export function applyMaskedFields(frm) {
	const names = frm && frm.meta && frm.meta.masked_fields;
	if (!names || !names.length || !frm.fields_dict) return;
	// Translated at run time, in the user's language.
	const reason = __("Hidden for your role");
	names.forEach((name) => {
		const field = frm.fields_dict[name];
		const wrapper = field && toElement(field.wrapper);
		if (!wrapper) return;
		setAttr(wrapper, "data-ins-masked", "1");
		const node = reasonElement(wrapper);
		if (node.textContent !== reason) node.textContent = reason;
		wrapper.querySelectorAll("input, textarea, select").forEach((control) => {
			setAttr(control, "aria-describedby", node.id);
		});
		const value = wrapper.querySelector(".control-value");
		if (value) {
			setAttr(value, "role", "textbox");
			setAttr(value, "aria-readonly", "true");
			setAttr(value, "tabindex", "0");
			setAttr(value, "aria-describedby", node.id);
			const label = wrapper.querySelector(".control-label");
			if (label && label.textContent.trim()) {
				if (!label.id) label.id = node.id + "-label";
				setAttr(value, "aria-labelledby", label.id);
			} else if (field.df && field.df.label) {
				setAttr(value, "aria-label", __(field.df.label));
			}
		}
	});
}

export function initMaskedFields() {
	if (!window.jQuery) return;
	jQuery(document).on("form-refresh.ins_shell_masked", (event, frm) => {
		try {
			applyMaskedFields(frm);
		} catch (error) {
			warn("masked fields", error);
		}
	});
}
