// Institutional Theme shell script (ADR 0002, 0003, 0008).
//
// Attributes only, plus one ribbon element. The two opt-in behaviours (idle warning,
// connection banner) add one banner element each, and only when the site enables them.
// The only network call is the idle warning's "Stay signed in" button, one authenticated
// GET made when the user presses it. No core class is patched, no markup restructured,
// no eval and no inline handler. Every feature runs inside its own try/catch, so a
// failure leaves core looking as it does without the theme.
import { initDensity } from "./shell/density.js";
import { initFormStatus } from "./shell/form_status.js";
import { initActions } from "./shell/actions.js";
import { initMaskedFields } from "./shell/masked_fields.js";
import { initFieldErrors } from "./shell/field_errors.js";
import { initRibbon } from "./shell/ribbon.js";
import { initIdleWarning } from "./shell/idle_warning.js";
import { initConnectionBanner } from "./shell/connection_banner.js";

(function start() {
	// Idempotent: a second evaluation of the bundle does nothing.
	const root = document.documentElement;
	if (!root || root.hasAttribute("data-ins-shell")) return;
	root.setAttribute("data-ins-shell", "1");

	[
		initDensity,
		initFormStatus,
		initActions,
		initMaskedFields,
		initFieldErrors,
		initRibbon,
		initIdleWarning,
		initConnectionBanner,
	].forEach((init) => {
		try {
			init();
		} catch (error) {
			if (window.console && console.warn) console.warn("Institutional Theme:", error);
		}
	});
})();
