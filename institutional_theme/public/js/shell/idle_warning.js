// Idle warning (ADR 0005, D7). Opt in: frappe.boot.ins.idle_warning, off by default.
//
// After `idle_minutes` without input (and in any case before the session can expire) a banner asks
// the user whether to stay signed in. Core keeps a session alive by any request (the session is
// updated when a request finishes, frappe/app.py:434, frappe/sessions.py:406), so "Stay signed in"
// makes one small authenticated GET: `frappe.auth.get_logged_user` (frappe/auth.py:450). The session
// length is System Settings `session_expiry` ("hh:mm", copied into `frappe.boot.sysdefaults` when an
// administrator saves it, system_settings.py:215-220); core falls back to 240 hours
// (sessions.py:519), so the same default is used when the value is absent.
import { showBanner, hideBanner, findBanner } from "./banner.js";
import { warn } from "./dom.js";

const KIND = "idle";
const DEFAULT_EXPIRY_SECONDS = 240 * 3600;
const LEAD_SECONDS = 60;
const MIN_WARN_SECONDS = 10;
const INPUT_EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"];
let started = false;
let lastInput = 0;
let timer = null;
let warnAfterMs = 0;
let returnFocus = null;

// "hh:mm" or "hh:mm:ss" to seconds; anything unreadable gives core's default.
export function expirySeconds(value) {
	const parts = String(value || "").split(":");
	if (parts.length < 2 || parts.length > 3) return DEFAULT_EXPIRY_SECONDS;
	const numbers = parts.map((part) => parseInt(part, 10));
	if (numbers.some((n) => isNaN(n) || n < 0)) return DEFAULT_EXPIRY_SECONDS;
	const total = numbers[0] * 3600 + numbers[1] * 60 + (numbers[2] || 0);
	return total > 0 ? total : DEFAULT_EXPIRY_SECONDS;
}

// Idle limit in milliseconds: the setting, but never later than one minute before the session ends.
export function warnAfter(idleMinutes, sessionSeconds) {
	const wanted = Math.max(1, Number(idleMinutes) || 5) * 60;
	const latest = Math.max(MIN_WARN_SECONDS, sessionSeconds - LEAD_SECONDS);
	return Math.min(wanted, latest) * 1000;
}

function schedule() {
	if (timer) clearTimeout(timer);
	const wait = Math.max(0, lastInput + warnAfterMs - Date.now());
	timer = setTimeout(check, wait + 50);
}

function check() {
	timer = null;
	if (Date.now() - lastInput >= warnAfterMs) {
		showWarning();
	} else {
		schedule();
	}
}

function dismiss() {
	hideBanner(KIND);
	if (returnFocus && typeof returnFocus.focus === "function" && document.contains(returnFocus)) {
		try {
			returnFocus.focus();
		} catch (error) {
			warn("idle warning focus", error);
		}
	}
	returnFocus = null;
	lastInput = Date.now();
	schedule();
}

function ended() {
	showBanner(KIND, __("Your session has ended. Sign in again to continue."), {
		label: __("Sign in"),
		onClick: () => window.location.reload(),
	});
}

function stay() {
	if (!window.frappe || typeof frappe.call !== "function") return ended();
	frappe.call({
		method: "frappe.auth.get_logged_user",
		type: "GET",
		freeze: false,
		callback: (response) => {
			if (response && response.message && response.message !== "Guest") dismiss();
			else ended();
		},
		error: () => {
			if (findBanner(KIND)) {
				showBanner(KIND, __("The session could not be refreshed. Try again."), {
					label: __("Stay signed in"),
					onClick: stay,
				});
			}
		},
	});
}

function showWarning() {
	if (findBanner(KIND)) return;
	returnFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
	const banner = showBanner(KIND, __("You have been inactive. Your session may end soon."), {
		label: __("Stay signed in"),
		onClick: stay,
	});
	const button = banner && banner.querySelector(".ins-banner-action");
	if (button) button.focus();
}

function onInput() {
	// While the warning is open, input does not extend the session: only the button does.
	if (!findBanner(KIND)) lastInput = Date.now();
}

export function initIdleWarning() {
	const ins = window.frappe && frappe.boot && frappe.boot.ins;
	if (!ins || !ins.idle_warning || started) return;
	started = true;
	const sysdefaults = (frappe.boot && frappe.boot.sysdefaults) || {};
	warnAfterMs = warnAfter(ins.idle_minutes, expirySeconds(sysdefaults.session_expiry));
	lastInput = Date.now();
	INPUT_EVENTS.forEach((name) => document.addEventListener(name, onInput, { capture: true, passive: true }));
	schedule();
}
