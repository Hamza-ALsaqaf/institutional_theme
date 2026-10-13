// Institutional Theme shell script (ADR 0002, 0003, 0008).
//
// Attributes only: this script writes data-ins-* attributes and appends one
// ribbon element. It makes no network call, patches no core class, restructures
// no markup, uses no eval and no inline handler. Every feature runs inside its
// own try/catch, so a failure leaves core looking as it does without the theme.
import { initDensity } from "./shell/density.js";
import { initFormStatus } from "./shell/form_status.js";
import { initActions } from "./shell/actions.js";
import { initMaskedFields } from "./shell/masked_fields.js";
import { initRibbon } from "./shell/ribbon.js";

(function start() {
	// Idempotent: a second evaluation of the bundle does nothing.
	const root = document.documentElement;
	if (!root || root.hasAttribute("data-ins-shell")) return;
	root.setAttribute("data-ins-shell", "1");

	[initDensity, initFormStatus, initActions, initMaskedFields, initRibbon].forEach((init) => {
		try {
			init();
		} catch (error) {
			if (window.console && console.warn) console.warn("Institutional Theme:", error);
		}
	});
})();
