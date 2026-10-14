// Child-table (grid) selection checkboxes get an accessible name (WCAG 1.3.1, 4.1.2).
// Core writes the row checkbox as a bare `<input type="checkbox" class="grid-row-check">` with no label
// (frappe/public/js/frappe/form/grid_row.js:17, placed by render_row at :250 and by render_template at
// :215), and the header "select all" checkbox is the same markup inside `.grid-heading-row`
// (grid.js:78, header row created at grid.js:450). A screen reader announces both as an unnamed
// checkbox. This module sets `aria-label` on each: "Select row N" for a data row, "Select all rows" for the
// header.
//
// The row number is core's own: `set_row_index` (grid_row.js:73) writes `data-idx` on the row and the
// number into `.row-index span`. Adding, deleting and drag-reordering rows all go through it, so one
// MutationObserver per grid, watching added nodes and `data-idx`, keeps every name correct. A row that
// changes is relabelled alone; the grid and the form are never rescanned.
//
// Grids do not exist yet at `form-refresh` (controls are made afterwards, form.js:625 comes before
// `refresh_fields`), so a second, light observer on the form layout only looks for `.form-grid`
// elements in added nodes and hands each one to its own observer, once. A checkbox that already has an
// `aria-label` or `aria-labelledby` that this module did not write (core adding a name in a later
// release) is left untouched.
import { toElement, setAttr, warn } from "./dom.js";

const CHECK = ".grid-row-check";
const watchedLayouts = new WeakSet();
const watchedGrids = new WeakSet();
// The value this module last wrote on a checkbox, to tell its own label from one core wrote.
const written = new WeakMap();

function rowNumber(row) {
	const idx = row.getAttribute("data-idx");
	if (idx) return idx;
	const span = row.querySelector(".row-index span, .template-row-index span");
	return span ? span.textContent.trim() : "";
}

export function nameCheckbox(check) {
	if (!check || check.type !== "checkbox") return;
	const row = check.closest(".grid-row");
	if (!row) return;
	const current = check.getAttribute("aria-label");
	if (check.hasAttribute("aria-labelledby")) return;
	if (current !== null && written.get(check) !== current) return;
	let label;
	if (check.closest(".grid-heading-row")) {
		label = __("Select all rows");
	} else {
		const number = rowNumber(row);
		label = number ? __("Select row {0}", [number]) : __("Select row");
	}
	written.set(check, label);
	setAttr(check, "aria-label", label);
}

export function nameRow(row) {
	if (!row || !row.isConnected) return;
	row.querySelectorAll(CHECK).forEach(nameCheckbox);
}

function gridObserver(grid) {
	let queued = false;
	const pending = new Set();
	const run = () => {
		queued = false;
		const rows = Array.from(pending);
		pending.clear();
		try {
			rows.forEach(nameRow);
		} catch (error) {
			warn("grid names", error);
		}
	};
	const schedule = () => {
		if (queued) return;
		queued = true;
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
		else setTimeout(run, 16);
	};
	const collect = (row) => {
		if (row) pending.add(row);
	};
	new MutationObserver((records) => {
		for (const record of records) {
			if (record.type === "attributes") {
				collect(record.target.closest(".grid-row"));
				continue;
			}
			// Text of the row number replaced inside an existing row.
			collect(record.target.closest && record.target.closest(".grid-row"));
			record.addedNodes.forEach((node) => {
				if (node.nodeType !== 1) return;
				const own = node.closest(".grid-row");
				if (own) collect(own);
				else node.querySelectorAll(".grid-row").forEach(collect);
			});
		}
		if (pending.size) schedule();
	}).observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-idx"] });
}

export function watchGrid(grid) {
	if (!grid || watchedGrids.has(grid) || typeof MutationObserver !== "function") return;
	watchedGrids.add(grid);
	grid.querySelectorAll(".grid-row").forEach(nameRow);
	gridObserver(grid);
}

export function watchLayout(frm) {
	const root = frm && frm.layout && toElement(frm.layout.wrapper);
	if (!root) return;
	root.querySelectorAll(".form-grid").forEach(watchGrid);
	if (watchedLayouts.has(root) || typeof MutationObserver !== "function") return;
	watchedLayouts.add(root);
	new MutationObserver((records) => {
		try {
			for (const record of records) {
				record.addedNodes.forEach((node) => {
					if (node.nodeType !== 1) return;
					const grid = node.closest(".form-grid");
					if (grid) watchGrid(grid);
					else node.querySelectorAll(".form-grid").forEach(watchGrid);
				});
			}
		} catch (error) {
			warn("grid names", error);
		}
	}).observe(root, { childList: true, subtree: true });
}

export function initGridNames() {
	if (!window.jQuery) return;
	jQuery(document).on("form-refresh.ins_shell_grid_names", (event, frm) => {
		try {
			watchLayout(frm);
		} catch (error) {
			warn("grid names", error);
		}
	});
}
