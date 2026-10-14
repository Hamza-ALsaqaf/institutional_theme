// Appearance page (ADR 0002): mode, density and colour preset as native radio groups.
// Keyboard operable in both directions: the browser moves a radio selection with the arrow keys,
// so nothing here handles keys. No core dialog is opened; every choice is announced in a
// role="status" region. Reads only frappe.boot.ins; the server validates every value again.
(function () {
	const MODES = [
		["light", () => __("Light")],
		["dark", () => __("Dark")],
		["automatic", () => __("Automatic")],
	];
	const DENSITIES = [
		["comfortable", () => __("Comfortable")],
		["compact", () => __("Compact")],
	];
	const METHOD = "institutional_theme.api.set_appearance";
	const CHANGED_KEY = "ins_palette_changed";
	const root = document.documentElement;
	const ins = () => (window.frappe && frappe.boot && frappe.boot.ins) || {};

	function el(tag, attrs, text) {
		const node = document.createElement(tag);
		Object.keys(attrs || {}).forEach((name) => node.setAttribute(name, attrs[name]));
		if (text !== undefined) node.textContent = text;
		return node;
	}

	// One native radio inside its label. `extra` adds content after the name.
	function option(group, value, label, checked, extra) {
		const id = "ins-" + group + "-" + value;
		const wrapper = el("div", { class: "ins-appearance-option" });
		const input = el("input", { type: "radio", name: "ins-" + group, id: id, value: value });
		input.checked = !!checked;
		const text = el("label", { for: id });
		text.appendChild(el("span", { class: "ins-appearance-name" }, label));
		if (extra) extra.forEach((node) => text.appendChild(node));
		wrapper.appendChild(input);
		wrapper.appendChild(text);
		return { wrapper: wrapper, input: input };
	}

	function fieldset(group, legend) {
		const set = el("fieldset", { class: "ins-appearance-group", "data-group": group });
		set.appendChild(el("legend", {}, legend));
		return set;
	}

	class InsAppearance {
		constructor(wrapper, page) {
			this.page = page;
			this.body = el("div", { class: "ins-appearance" });
			this.title = el("h1", { tabindex: "-1" }, __("Appearance"));
			this.status = el("div", {
				role: "status",
				"aria-live": "polite",
				class: "ins-sr-only sr-only",
			});
			this.body.appendChild(this.title);
			this.body.appendChild(this.status);
			this.buildMode();
			this.buildDensity();
			this.buildPresets();
			$(page.main).empty().append(this.body);
			this.reloadMessage = this.takeReloadMessage();
		}

		announce(message) {
			// Clearing first makes a repeated message announce again.
			this.status.textContent = "";
			window.setTimeout(() => {
				this.status.textContent = message;
			}, 50);
		}

		// A failed save puts the previous radio back and returns focus to it (the focused radio is
		// the one the user just chose, which is no longer selected).
		restore(set, value) {
			const radio = set.querySelector('input[value="' + value + '"]');
			if (!radio) return;
			radio.checked = true;
			radio.focus();
		}

		save(args) {
			return frappe.xcall(METHOD, args, "POST");
		}

		buildMode() {
			const set = fieldset("mode", __("Mode"));
			const current = (root.getAttribute("data-theme-mode") || "light").toLowerCase();
			MODES.forEach(([value, label]) => {
				const item = option("mode", value, label(), value === current);
				item.input.addEventListener("change", () => this.changeMode(value, label()));
				set.appendChild(item.wrapper);
			});
			this.body.appendChild(set);
			this.modeSet = set;
		}

		changeMode(value, label) {
			const previous = (root.getAttribute("data-theme-mode") || "light").toLowerCase();
			// Core's own observer on data-theme-mode applies the theme (desk.js:110-118).
			root.setAttribute("data-theme-mode", value);
			frappe
				.xcall(
					"frappe.core.doctype.user.user.switch_theme",
					{ theme: value.charAt(0).toUpperCase() + value.slice(1) },
					"POST"
				)
				.then(() => this.announce(__("Mode changed to {0}.", [label])))
				.catch(() => {
					root.setAttribute("data-theme-mode", previous);
					this.restore(this.modeSet, previous);
					this.announce(__("The mode could not be saved. The previous mode was restored."));
				});
		}

		buildDensity() {
			const set = fieldset("density", __("Density"));
			const current = ins().density === "compact" ? "compact" : "comfortable";
			DENSITIES.forEach(([value, label]) => {
				const item = option("density", value, label(), value === current);
				item.input.addEventListener("change", () => this.changeDensity(value, label()));
				set.appendChild(item.wrapper);
			});
			this.body.appendChild(set);
			this.densitySet = set;
			this.density = current;
		}

		changeDensity(value, label) {
			const previous = this.density;
			root.setAttribute("data-ins-density", value);
			this.save({ density: value })
				.then(() => {
					this.density = value;
					this.announce(__("Density changed to {0}.", [label]));
				})
				.catch(() => {
					root.setAttribute("data-ins-density", previous);
					this.restore(this.densitySet, previous);
					this.announce(__("The density could not be saved. The previous density was restored."));
				});
		}

		swatch(card) {
			const dots = el("span", { class: "ins-swatch", "aria-hidden": "true" });
			["primary", "accent"].forEach((name) => {
				const dot = el("span", { class: "ins-swatch-dot" });
				// The one inline value: the preset's own colour from the server, set on the CSS object model
				// (no style attribute text). The stylesheet draws the dot with var(--ins-swatch-colour).
				dot.style.setProperty("--ins-swatch-colour", String(card[name] || ""));
				dots.appendChild(dot);
			});
			return dots;
		}

		buildPresets() {
			const cards = ins().allowed || [];
			const set = fieldset("palette", __("Colour preset"));
			this.effective = ins().palette;
			this.selected = this.effective;
			if (cards.length <= 1) {
				const only = cards[0];
				set.appendChild(el("p", { class: "ins-appearance-name" }, only ? only.label : ""));
				set.appendChild(el("p", { class: "ins-appearance-help" }, __("Set by your administrator.")));
				this.body.appendChild(set);
				return;
			}
			this.cards = {};
			cards.forEach((card) => {
				const marker = el("span", { class: "ins-selected" });
				const item = option("palette", card.key, card.label, card.key === this.effective, [
					this.swatch(card),
					marker,
				]);
				this.cards[card.key] = { card: card, marker: marker };
				item.input.addEventListener("change", () => this.selectPreset(card.key));
				set.appendChild(item.wrapper);
			});
			this.apply = el("button", { type: "button", class: "btn btn-primary btn-sm" }, __("Apply colour preset"));
			this.apply.addEventListener("click", () => this.applyPreset());
			set.appendChild(this.apply);
			// The visible reason the button is disabled; shown only while it is (see renderSelected).
			this.hint = el("p", { id: "ins-apply-hint", class: "ins-appearance-apply-hint" });
			this.apply.setAttribute("aria-describedby", "ins-apply-hint");
			set.appendChild(this.hint);
			this.body.appendChild(set);
			this.renderSelected();
		}

		selectPreset(key) {
			this.selected = key;
			this.renderSelected();
		}

		renderSelected() {
			Object.keys(this.cards).forEach((key) => {
				const marker = this.cards[key].marker;
				marker.textContent = "";
				if (key !== this.selected) return;
				marker.appendChild(el("span", { "aria-hidden": "true", class: "ins-selected-icon" }, "✓"));
				marker.appendChild(el("span", { class: "ins-selected-text" }, __("Selected")));
			});
			this.apply.disabled = this.selected === this.effective;
			this.hint.textContent = this.apply.disabled ? __("Choose a different colour preset to apply it.") : "";
		}

		applyPreset() {
			const key = this.selected;
			if (key === this.effective) return;
			this.apply.disabled = true;
			this.save({ palette: key })
				.then(() => {
					try {
						window.sessionStorage.setItem(CHANGED_KEY, this.cards[key].card.label);
					} catch (error) {
						// Storage can be blocked; the reload below still applies the preset.
					}
					window.location.reload();
				})
				.catch(() => {
					this.apply.disabled = false;
					this.apply.focus();
					this.announce(__("The colour preset could not be applied. Try again."));
				});
		}

		// After the reload that applied a preset: read the stored label once. The message is spoken and
		// focus moves to the heading only when the page is shown (a hidden region is not announced).
		takeReloadMessage() {
			let label = null;
			try {
				label = window.sessionStorage.getItem(CHANGED_KEY);
				if (label !== null) window.sessionStorage.removeItem(CHANGED_KEY);
			} catch (error) {
				label = null;
			}
			return label === null ? null : __("Colour preset changed to {0}.", [label]);
		}

		// Called by core when the page container is shown (views/pageview.js:105-107).
		shown() {
			if (this.reloadMessage === null) return;
			const message = this.reloadMessage;
			this.reloadMessage = null;
			this.title.focus();
			this.announce(message);
		}
	}

	frappe.pages["ins-appearance"].on_page_show = function (wrapper) {
		if (wrapper && wrapper.ins_appearance) wrapper.ins_appearance.shown();
	};

	frappe.pages["ins-appearance"].on_page_load = function (wrapper) {
		const page = frappe.ui.make_app_page({
			parent: wrapper,
			title: __("Appearance"),
			single_column: true,
		});
		wrapper.ins_appearance = new InsAppearance(wrapper, page);
	};
})();
