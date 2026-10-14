"""Read-only: which settings state yields the file name seen in the failed assertion of test_site_files (16.32.0 loaded run).

Computes the generated palette file name for every pair of the colours that the tests of this app use as the custom
primary and accent, and prints the pairs whose name is the one in the failed assertion (ins_palette_custom.2438def10b0c.css).
"""

import itertools
import os
from pathlib import Path

import frappe

frappe.init(site="midad.test", sites_path=".")
frappe.connect()
from institutional_theme import site_files

SEEN = "ins_palette_custom.2438def10b0c.css"
colours = ["#103A55", "#1F3A5F", "#243B7A", "#2A4A6E", "#8A6D1F", "#B08D57", "#D9E2F3", "#FFF2CC"]
found = []
for primary, accent in itertools.permutations(colours, 2):
	content = site_files.palette_content({"allow_custom": 1, "custom_primary": primary, "custom_accent": accent})
	if content and site_files.file_name(site_files.PALETTE_PREFIX, content) == SEEN:
		found.append((primary, accent))
print("pairs whose file is", SEEN, ":", found)
own = site_files.palette_content({"allow_custom": 1, "custom_primary": "#1F3A5F", "custom_accent": "#8A6D1F"})
print("file name of the failing test's own save (#1F3A5F/#8A6D1F):", site_files.file_name(site_files.PALETTE_PREFIX, own))
doc = frappe.get_doc("Institutional Theme Settings")
print("committed state now:", {k: doc.get(k) for k in ("allow_custom", "default_palette", "custom_primary", "custom_accent")})
folder = site_files._folder()
print("folder:", sorted(p.name for p in Path(folder).glob("*")) if os.path.isdir(folder) else "absent")
frappe.destroy()
