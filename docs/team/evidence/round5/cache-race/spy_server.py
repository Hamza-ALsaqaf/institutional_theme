"""Diagnosis only: a second development web server on the same site that records the exception behind every
"500: There was an error building this page" (core turns it into the generic page without logging it).

    ../env/bin/python spy_server.py <site> <port> <out-file>     (cwd: the bench's sites folder)

`frappe.website.serve.handle_exception` is wrapped IN THIS PROCESS ONLY. Nothing on disk, in core or in the app changes.
"""

import sys
import threading
import traceback

import frappe.website.serve as serve
from werkzeug.serving import run_simple

import frappe
import frappe.app

site, port, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
lock = threading.Lock()
real = serve.handle_exception


def spy(e, endpoint, path, http_status_code):
	if not isinstance(e, frappe.PageDoesNotExistError | frappe.Redirect | frappe.PermissionError):
		with lock, open(out, "a") as handle:
			handle.write(f"=== {path} {type(e).__name__}\n{''.join(traceback.format_exception(e))[-2500:]}\n")
	return real(e, endpoint, path, http_status_code)


serve.handle_exception = spy
run_simple("127.0.0.1", port, frappe.app.application, threaded=True, use_reloader=False)
