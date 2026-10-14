// Connection banner (ADR 0005, D7). Opt in: frappe.boot.ins.connection_banner, off by default.
// Listens to the browser's own `offline` and `online` events and, when core's realtime client
// exists (frappe/public/js/frappe/socketio_client.js, `frappe.realtime.socket`, a socket.io client),
// to its `disconnect` and `connect` events. It reads state and shows one banner; it sends nothing.
import { showBanner, hideBanner } from "./banner.js";
import { warn } from "./dom.js";

const RESTORED_MS = 4000;
const attached = new WeakSet();
let started = false;
let restoredTimer = null;
let realtimeDown = false;

function offline() {
	return !!(navigator && navigator.onLine === false);
}

function render() {
	if (restoredTimer) {
		clearTimeout(restoredTimer);
		restoredTimer = null;
	}
	if (offline()) {
		showBanner("offline", __("You are offline. Changes cannot be saved until the connection returns."));
	} else if (realtimeDown) {
		showBanner("offline", __("Live updates are interrupted. The page will keep trying to reconnect."));
	} else {
		hideBanner("offline");
	}
}

// Briefly confirms the return of the connection, then removes the banner.
function restored() {
	if (offline()) return render();
	if (realtimeDown) return render();
	showBanner("offline", __("The connection is back."));
	restoredTimer = setTimeout(render, RESTORED_MS);
}

// Core creates the socket after the desk starts, so it is looked for again on every page change.
function attachRealtime() {
	const socket = window.frappe && frappe.realtime && frappe.realtime.socket;
	if (!socket || typeof socket.on !== "function" || attached.has(socket)) return;
	attached.add(socket);
	socket.on("disconnect", (reason) => {
		// "io client disconnect" is a deliberate close by the page itself, not a failure.
		if (reason === "io client disconnect") return;
		realtimeDown = true;
		render();
	});
	socket.on("connect", () => {
		if (!realtimeDown) return;
		realtimeDown = false;
		restored();
	});
}

export function initConnectionBanner() {
	const ins = window.frappe && frappe.boot && frappe.boot.ins;
	if (!ins || !ins.connection_banner || started) return;
	started = true;
	const start = () => {
		window.addEventListener("offline", () => {
			try {
				render();
			} catch (error) {
				warn("connection banner", error);
			}
		});
		window.addEventListener("online", () => {
			try {
				restored();
			} catch (error) {
				warn("connection banner", error);
			}
		});
		render();
		if (window.jQuery) {
			jQuery(document).on("page-change.ins_shell_connection", () => {
				try {
					attachRealtime();
				} catch (error) {
					warn("connection banner", error);
				}
			});
		}
	};
	if (document.body) start();
	else document.addEventListener("DOMContentLoaded", start, { once: true });
}
