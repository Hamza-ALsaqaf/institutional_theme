// Parses the generated SCSS partials into per-mode declaration layers and resolves var() chains.
// Used to compute the expected value of every Frappe variable without trusting the browser.
import { readFileSync } from "node:fs";

export function parseBlocks(text) {
	text = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
	const blocks = [];
	let i = 0;
	const walk = (media) => {
		while (i < text.length) {
			const open = text.indexOf("{", i);
			const close = text.indexOf("}", i);
			if (close !== -1 && (open === -1 || close < open)) {
				i = close + 1;
				return;
			}
			if (open === -1) return;
			const head = text.slice(i, open).trim();
			i = open + 1;
			if (head.startsWith("@media")) {
				walk(head);
			} else {
				const end = text.indexOf("}", i);
				const decls = {};
				for (const d of text.slice(i, end).split(";")) {
					const m = d.match(/^\s*(--[\w-]+|color-scheme)\s*:\s*([\s\S]+?)\s*$/);
					if (m) decls[m[1]] = m[2].replace(/\s+/g, " ");
				}
				blocks.push({ media, selector: head.replace(/\s+/g, " "), decls });
				i = end + 1;
			}
		}
	};
	walk(null);
	return blocks;
}

function family(b) {
	if (/data-theme="dark"/.test(b.selector)) return "dark";
	if (/data-theme="automatic"/.test(b.selector)) return b.media ? "auto" : "autoplain";
	if (/data-theme="light"/.test(b.selector) || /^html:root(\[dir\])?(\[data-ins-density="compact"\])?(,|$)/.test(b.selector)) return "light";
	return "any";
}

// mode: "light" | "dark" | "automatic"; scheme: prefers-color-scheme value
export function layers(files, mode, scheme) {
	const out = {};
	for (const f of files) {
		const blocks = parseBlocks(readFileSync(f, "utf8"));
		// Order inside one file follows the real specificity ladder: any, light, then the active mode block.
		const pick = (fam) => blocks.filter((b) => !/pointer|compact/.test(b.media + b.selector) && family(b) === fam);
		const active = mode === "dark" ? ["dark"] : mode === "automatic" ? ["autoplain", ...(scheme === "dark" ? ["auto"] : [])] : [];
		for (const fam of ["any", "light", ...active]) for (const b of pick(fam)) Object.assign(out, b.decls);
	}
	return out;
}

export function resolve(value, decls, depth = 0) {
	if (depth > 20) throw new Error("var() cycle: " + value);
	return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (_, name, fallback) => {
		if (decls[name] !== undefined) return resolve(decls[name], decls, depth + 1);
		if (fallback !== undefined) return resolve(fallback.trim(), decls, depth + 1);
		return `UNRESOLVED(${name})`;
	});
}

export const norm = (s) => s.replace(/\s+/g, " ").replace(/\s*,\s*/g, ",").replace(/\s*\(\s*/g, "(").replace(/\s*\)/g, ")").trim().toLowerCase();
