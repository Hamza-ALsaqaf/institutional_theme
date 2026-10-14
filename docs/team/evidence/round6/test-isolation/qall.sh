#!/bin/bash
# $1 bench dir  $2 site
cd $1/sites && $1/env/bin/python -c "
import frappe
frappe.init('$2'); frappe.connect()
g=frappe.db.get_single_value
print('$2', {f:g('Website Settings',f) for f in ('app_name','app_logo','splash_image','favicon','home_page','website_theme','title_prefix')}, 'navbar', g('Navbar Settings','app_logo'))
print('  settings doc:', {f:g('Institutional Theme Settings',f) for f in ('system_name','emblem','favicon')}, 'sys app_name', g('System Settings','app_name'))
print('  ins globals:', [r.defkey for r in frappe.get_all('DefaultValue', filters={'parent':'__global','defkey':('like','ins_%')}, fields=['defkey'])])
print('  ins-test files:', frappe.db.count('File', {'file_name': ('like','ins-%')}))
"
