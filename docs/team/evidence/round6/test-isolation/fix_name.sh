#!/bin/bash
# $1 bench dir $2 site : put Website Settings app_name back to the value of the bench build
cd $1/sites && $1/env/bin/python -c "
import frappe
frappe.init('$2'); frappe.connect()
frappe.db.set_single_value('Website Settings','app_name','Frappe', update_modified=False)
frappe.db.commit(); frappe.clear_cache()
print('$2 app_name ->', frappe.db.get_single_value('Website Settings','app_name'))
"
