"""Build docs/proof/midad-proof.html from a built bench (ADR 0007). Standard library only.

Usage: python3 tools/proof/build_proof.py [--bench /home/user/frappe-bench] [--out docs/proof/midad-proof.html]
Inputs: sites/assets/assets.json and assets-rtl.json, tools/proof/{partials,strings.json,proof.js,proof.css}, docs/audits/contrast.json.
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent

# (manifest key, kind, name). Order equals production: core, then the theme.
DESK_SET = [
	("desk.bundle.css", "core", "desk"),
	("report.bundle.css", "core", "report"),
	("erpnext.bundle.css", "core", "erpnext"),
	("ins_desk.bundle.css", "ins", "desk"),
	("ins_palette_graphite.bundle.css", "palette", "graphite"),
	("ins_palette_forest.bundle.css", "palette", "forest"),
	("ins_palette_petrol.bundle.css", "palette", "petrol"),
	("ins_palette_plum.bundle.css", "palette", "plum"),
	("ins_fonts_noto.bundle.css", "fonts", "noto"),
	("ins_fonts_tajawal.bundle.css", "fonts", "tajawal"),
]
WEB_SET = [
	("website.bundle.css", "core", "website"),
	("erpnext-web.bundle.css", "core", "erpnext-web"),
	("ins_web.bundle.css", "ins", "web"),
	("login.bundle.css", "core", "login"),
]
ICON_FILES = ["timeless", "espresso", "lucide"]
FONT_MIME = {".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf"}
URL_RE = re.compile(r"url\((['\"]?)(/assets/institutional_theme/[^)'\"]+)\1\)")


def manifest(bench: Path, rtl: bool) -> dict[str, str]:
	name = "assets-rtl.json" if rtl else "assets.json"
	return json.loads((bench / "sites/assets" / name).read_text(encoding="utf-8"))


def resolve(bench: Path, key: str, rtl: bool) -> tuple[str, str]:
	m = manifest(bench, rtl)
	k = ("rtl_" + key) if rtl else key
	if k not in m:
		sys.exit(f"build_proof: manifest key {k} missing (is the bench built?)")
	return m[k], (bench / "sites" / m[k].lstrip("/")).read_text(encoding="utf-8")


class Fonts:
	"""Replace the theme's font urls with data: URIs; count what stays external."""

	def __init__(self, bench: Path):
		self.bench = bench
		self.cache: dict[str, str] = {}
		self.bytes = 0

	def inline(self, css: str) -> str:
		def sub(m: re.Match) -> str:
			path = m.group(2)
			if path not in self.cache:
				f = self.bench / "sites" / path.lstrip("/")
				data = f.read_bytes()
				self.bytes += len(data)
				mime = FONT_MIME.get(f.suffix.lower(), "application/octet-stream")
				self.cache[path] = f"data:{mime};base64,{base64.b64encode(data).decode()}"
			return f"url({self.cache[path]})"

		return URL_RE.sub(sub, css)


def style_tag(path: str, css: str, rtl: bool, kind: str, name: str, group: str) -> str:
	if "</style" in css:
		sys.exit(f"build_proof: {path} contains a closing style tag")
	return f'<style data-src="{path}" data-dir="{"rtl" if rtl else "ltr"}" data-kind="{kind}" data-name="{name}" data-set="{group}">{css}</style>'


def collect_styles(bench: Path, fonts: Fonts, entries, group: str):
	tags, texts, paths = [], [], {}
	for rtl in (False, True):
		for key, kind, name in entries:
			path, css = resolve(bench, key, rtl)
			css = fonts.inline(css)
			tags.append(style_tag(path, css, rtl, kind, name, group))
			texts.append(css)
			paths[("rtl_" if rtl else "") + key] = path
	return tags, texts, paths


def sprite(bench: Path, ids: set[str]) -> str:
	found: dict[str, str] = {}
	for lib in ICON_FILES:
		src = (bench / f"apps/frappe/frappe/public/icons/{lib}/icons.svg").read_text(encoding="utf-8")
		for m in re.finditer(r'<symbol\b[^>]*\bid="([^"]+)"[^>]*>.*?</symbol>', src, re.S):
			if m.group(1) in ids and m.group(1) not in found:
				found[m.group(1)] = m.group(0)
	missing = ids - set(found)
	if missing:
		sys.exit(f"build_proof: icon symbols not found in core sprites: {sorted(missing)}")
	return (
		'<svg id="all-symbols" xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">'
		+ "".join(found.values())
		+ "</svg>"
	)


def i18n(html: str, strings: dict) -> str:
	"""`<tag>[[key]]</tag>` becomes `<tag data-i18n="key">English</tag>`; `attr="[[key]]"` gets data-i18n-attr."""
	en = strings["en"]

	def text(m: re.Match) -> str:
		tag, attrs, key = m.group(1), m.group(2), m.group(3)
		if key not in en:
			sys.exit(f"build_proof: string key {key} missing")
		return f'<{tag}{attrs} data-i18n="{key}">{en[key]}</{tag}>'

	html = re.sub(r"<(\w+)([^>]*)>\[\[([\w.]+)\]\]</\1>", text, html)

	def attr(m: re.Match) -> str:
		a, key = m.group(1), m.group(2)
		return f'{a}="{en[key]}" data-i18n-{a}="{key}"'

	html = re.sub(r'(placeholder|title|aria-label)="\[\[([\w.]+)\]\]"', attr, html)
	left = re.findall(r"\[\[([\w.]+)\]\]", html)
	if left:
		sys.exit(f"build_proof: unresolved string placeholders {left}")
	return html


def read(name: str) -> str:
	return (HERE / "partials" / name).read_text(encoding="utf-8")


def page_head(title_key: str, crumb: str, indicator: str, actions: str) -> str:
	return (
		read("_page_head.html")
		.replace("[[page.title]]", f"[[{title_key}]]")
		.replace("%%CRUMB%%", crumb)
		.replace("%%INDICATOR%%", indicator)
		.replace("%%ACTIONS%%", actions)
	)


NEW_BTN = '<button class="btn btn-primary btn-sm primary-action">[[page.new]]</button>'
SAVE_BTN = '<button class="btn btn-primary btn-sm primary-action">[[page.save]]</button>'
COLS = [(0, 32), (1, 31), (2, 120), (3, 300), (4, 120), (5, 120), (6, 120)]
CELL_H = 35


def cell(col: int, row, content: str, header: bool, sticky_last: bool = False) -> str:
	sticky = " dt-cell--sticky" if col < 2 else ""
	last = " dt-cell--sticky-last" if col == 1 else ""
	if header:
		cls = f"dt-cell dt-cell--col-{col} dt-cell--header dt-cell--header-{col}{sticky}{' dt-cell--sticky-top' if col < 2 else ''}{last}"
		return f'<div class="{cls}" data-col-index="{col}" data-is-header="1" tabindex="0"><div class="dt-cell__content dt-cell__content--header-{col}" style="width: {dict(COLS)[col]}px;">{content}</div></div>'
	cls = f"dt-cell dt-cell--col-{col} dt-cell--{col}-{row} dt-cell--row-{row}{sticky}{last}"
	return f'<div class="{cls}" data-row-index="{row}" data-col-index="{col}" tabindex="0"><div class="dt-cell__content dt-cell__content--col-{col}">{content}</div></div>'


def datatable_parts() -> tuple[str, str, str]:
	heads = [
		'<input type="checkbox">',
		"",
		"[[report.id]]",
		"[[report.subject]]",
		"[[report.status]]",
		"[[report.priority]]",
		"[[report.due]]",
	]
	header = "".join(
		cell(c, 0, h if not h.startswith("[[") else f"<span>{h}</span>", True) for c, h in enumerate(heads)
	)
	rows = []
	data = [
		("TSK-0001", "report.r1", "list.open", "list.high", "06-11-2026"),
		("TSK-0002", "report.r2", "list.closed", "list.medium", "07-11-2026"),
		("TSK-0003", "report.r3", "list.open", "list.low", "08-11-2026"),
	]
	for i, (code, subj, st, pr, due) in enumerate(data):
		cells = [
			'<input type="checkbox">',
			str(i + 1),
			f'<a href="#"><bdi>{code}</bdi></a>',
			f"<span>[[{subj}]]</span>",
			f"<span>[[{st}]]</span>",
			f"<span>[[{pr}]]</span>",
			f"<bdi>{due}</bdi>",
		]
		body = "".join(cell(c, i, html, False) for c, html in enumerate(cells))
		rows.append(
			f'<div class="dt-row dt-row-{i} vrow" data-row-index="{i}" style="position: absolute; top: {i * CELL_H}px;">{body}</div>'
		)
	rules = [f".dt-instance-1 .dt-cell__content--col-{c} {{ width: {w}px; }}" for c, w in COLS]
	rules += [
		".dt-instance-1 .dt-cell--col-1.dt-cell--sticky { left: 34px; }",
		".dt-instance-1 .dt-cell--col-0.dt-cell--sticky { left: 0px; }",
		f".dt-instance-1 .dt-cell {{ height: {CELL_H}px; }}",
	]
	return header, "".join(rows), "\n".join(rules)


def workspace_parts() -> tuple[str, str]:
	arrow = '<svg class="es-icon es-line ml-2 icon-xs" aria-hidden="true"><use href="#es-line-arrow-up-right"></use></svg>'
	shortcuts = "".join(
		'<div class="ce-block col-xs-12 col-sm-6 col-md-4 col-lg-3"><div class="ce-block__content"><div>'
		f'<div class="widget shortcut-widget-box" role="link" tabindex="0" aria-label="[[ws.s{i}]]">'
		f'<div class="widget-head"><div class="widget-label"><div class="widget-title"><span class="ellipsis">[[ws.s{i}]]</span></div><div class="widget-subtitle"></div></div>'
		f'<div class="widget-control"><div class="indicator-pill no-indicator-dot ellipsis gray">{n}</div>{arrow}</div></div>'
		'<div class="widget-body"></div><div class="widget-footer"></div></div></div></div></div>'
		for i, n in ((1, 3), (2, 0), (3, 12))
	)

	def card(title: str, links: list[str]) -> str:
		body = "".join(
			f'<a href="#" class="link-item ellipsis onboard-spotlight" type="Link"><span class="link-content ellipsis"><span class="link-text">[[ws.l{k}]]</span>{arrow}</span></a>'
			for k in links
		)
		return (
			'<div class="ce-block col-xs-12 col-sm-6 col-md-4"><div class="ce-block__content"><div>'
			f'<div class="widget links-widget-box"><div class="widget-head"><div class="widget-label"><div class="widget-title"><span class="ellipsis">[[{title}]]</span></div><div class="widget-subtitle"></div></div><div class="widget-control"></div></div>'
			f'<div class="widget-body">{body}</div><div class="widget-footer"></div></div></div></div></div>'
		)

	return shortcuts, card("ws.c1", ["1", "2", "3", "4"]) + card("ws.c2", ["5", "6", "7", "8"])


def alerts_html() -> str:
	def one(cls: str, icon: str, msg: str, sub: str = "") -> str:
		return (
			f'<div class="alert desk-alert {cls}" role="alert"><div class="alert-message-container"><div class="alert-title-container">'
			f'<div><svg class="icon icon-lg" aria-hidden="true"><use href="#icon-{icon}"></use></svg></div><div class="alert-message">[[{msg}]]</div></div>'
			f'<div class="alert-subtitle">{"[[" + sub + "]]" if sub else ""}</div></div><div class="alert-body" style="display: none"></div>'
			'<a class="close"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-x"></use></svg></a></div>'
		)

	return (
		one("green", "solid-success", "toast.ok", "toast.sub")
		+ one("red", "solid-error", "toast.err")
		+ one("orange", "solid-warning", "toast.warn")
	)


def screens(strings: dict) -> tuple[str, str]:
	shell = read("_shell_sidebar.html")
	rows = read("_rows.html")
	header, body_rows, dt_rules = datatable_parts()
	out = {}
	out["list"] = (
		read("list.html")
		.replace("%%SHELL%%", shell)
		.replace("%%PAGEHEAD%%", page_head("page.list.title", "", "", NEW_BTN))
		.replace("%%ROWS%%", rows)
	)
	crumb = '<li class="disabled"><a href="#" class="title-text-form">[[page.form.crumb]]</a></li>'
	indicator = '<span class="indicator-pill no-indicator-dot whitespace-nowrap orange"><span>[[page.status.open]]</span></span>'
	out["form"] = (
		read("form.html")
		.replace("%%SHELL%%", shell)
		.replace("%%PAGEHEAD%%", page_head("page.title", crumb, indicator, SAVE_BTN))
	)
	out["report"] = (
		read("report.html")
		.replace("%%SHELL%%", shell)
		.replace("%%PAGEHEAD%%", page_head("page.report.title", "", "", ""))
		.replace("%%HEADERCELLS%%", header)
		.replace("%%BODYROWS%%", body_rows)
	)
	out["dialog"] = read("dialog.html")
	shortcuts, cards = workspace_parts()
	out["workspace"] = (
		read("workspace.html")
		.replace("%%SHELL%%", shell)
		.replace("%%PAGEHEAD%%", page_head("shell.home", "", "", ""))
		.replace("%%SHORTCUTS%%", shortcuts)
		.replace("%%CARDS%%", cards)
	)
	out["toast"] = (
		read("toast.html")
		.replace("%%SHELL%%", shell)
		.replace("%%PAGEHEAD%%", page_head("page.list.title", "", "", NEW_BTN))
		.replace("%%ROWS%%", rows)
		.replace("%%ALERTS%%", alerts_html())
	)
	html = "".join(
		f'<section class="proof-screen" id="screen-{k}" data-screen="{k}" hidden aria-label="{k}">{i18n(v, strings)}</section>'
		for k, v in out.items()
		if k != "login"
	)
	return html, dt_rules


def login_document(bench: Path, fonts: Fonts, strings: dict):
	tags, texts, paths = collect_styles(bench, fonts, WEB_SET, "web")
	body = i18n(read("login.html"), strings)
	doc = f'<!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="utf-8">{"".join(tags)}</head><body frappe-session-status="logged-out" data-path="login" class=" ins-has-masthead ins-auth">{body}</body></html>'
	if "</script" in doc:
		sys.exit("build_proof: login document contains a script end tag")
	return doc, body, texts, paths


def class_check(markup: str, css_texts: list[str], bench: Path) -> list[str]:
	"""Every class in the proof must exist in a compiled bundle, or in core/ERPNext/theme JS or templates."""
	classes = set()
	for m in re.finditer(r'\bclass="([^"]*)"', markup):
		classes.update(c for c in m.group(1).split() if not c.startswith("proof-"))
	known = set()
	for t in css_texts:
		known.update(re.findall(r"\.(-?[_a-zA-Z][\w-]*)", t))
	pending = classes - known
	if pending:
		roots = [
			bench / "apps/frappe/frappe/public/js",
			bench / "apps/frappe/frappe/templates",
			bench / "apps/frappe/frappe/www",
			bench / "apps/erpnext/erpnext/public/js",
			REPO / "institutional_theme/public/js",
			REPO / "institutional_theme/templates",
			bench / "apps/frappe/node_modules/frappe-datatable/src",
			bench / "apps/frappe/node_modules/frappe-datatable/dist",
		]
		for root in roots:
			if not root.exists():
				continue
			for f in root.rglob("*"):
				if f.suffix in {".js", ".html", ".vue", ".py", ".css"} and f.is_file():
					words = set(re.findall(r"[\w-]+", f.read_text(encoding="utf-8", errors="ignore")))
					# Indexed classes are built by template literals (`dt-cell--col-${index}`): the token keeps the prefix.
					pending = {
						c
						for c in pending
						if c not in words
						and (re.sub(r"\d+(-\d+)?$", "", c) not in words if re.search(r"\d$", c) else True)
					}
					if not pending:
						return []
	return sorted(pending)


def main() -> None:
	ap = argparse.ArgumentParser()
	ap.add_argument("--bench", default="/home/user/frappe-bench")
	ap.add_argument("--out", default=str(REPO / "docs/proof/midad-proof.html"))
	a = ap.parse_args()
	bench = Path(a.bench)
	strings = json.loads((HERE / "strings.json").read_text(encoding="utf-8"))
	if set(strings["en"]) != set(strings["ar"]):
		sys.exit("build_proof: strings.json en and ar keys differ")
	fonts = Fonts(bench)

	desk_tags, desk_texts, desk_paths = collect_styles(bench, fonts, DESK_SET, "desk")
	screen_html, dt_rules = screens(strings)
	login_doc, login_body, web_texts, web_paths = login_document(bench, fonts, strings)

	markup_for_check = screen_html + login_body
	bad = class_check(markup_for_check, desk_texts + web_texts, bench)
	if bad:
		sys.exit(f"build_proof: classes not found in any bundle, core JS or template: {bad}")

	ids = set(re.findall(r'href="#((?:icon|es)-[\w-]+)"', markup_for_check))
	icons = sprite(bench, ids)

	contrast = json.loads((REPO / "docs/audits/contrast.json").read_text(encoding="utf-8"))
	panel = {k: v["modes"] for k, v in contrast["presets"].items() if v.get("shipped")}
	proof_css = (HERE / "proof.css").read_text(encoding="utf-8")
	proof_js = (HERE / "proof.js").read_text(encoding="utf-8")
	data = {
		"strings": strings,
		"contrast": panel,
		"manifest": {**desk_paths, **web_paths},
		"presets": ["midad", "graphite", "forest", "petrol", "plum"],
		"fonts": ["plex", "noto", "tajawal"],
	}
	payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
	toolbar = (HERE / "toolbar.html").read_text(encoding="utf-8")
	html = (
		'<!DOCTYPE html><html lang="en" dir="ltr" data-theme-mode="light" data-theme="light" data-ins-shell="1" data-ins-density="comfortable">'
		'<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Midad proof</title>'
		+ "".join(desk_tags)
		+ f'<style data-src="proof:datatable-runtime">{dt_rules}</style>'
		+ f'<style data-src="proof:chrome">{proof_css}</style></head><body>'
		+ icons
		+ toolbar
		+ f'<main id="proof-stage">{screen_html}<section class="proof-screen" id="screen-login" data-screen="login" hidden aria-label="login"><iframe id="proof-login" title="login" data-srcdoc-id="proof-login-src"></iframe></section></main>'
		+ f'<script type="text/plain" id="proof-login-src">{login_doc}</script>'
		+ f'<script type="application/json" id="proof-data">{payload}</script>'
		+ f"<script>{proof_js}</script></body></html>"
	)
	out = Path(a.out)
	out.parent.mkdir(parents=True, exist_ok=True)
	out.write_text(html, encoding="utf-8")
	external = sorted(set(re.findall(r"url\((?:['\"]?)(/assets/[^)'\"]+)", html)))
	print(
		f"wrote {out} ({out.stat().st_size / 1e6:.2f} MB); inlined font files {len(fonts.cache)} ({fonts.bytes / 1e3:.0f} KB raw); external /assets/ urls left: {len(external)}"
	)
	for u in external[:12]:
		print("  external:", u)


if __name__ == "__main__":
	main()
