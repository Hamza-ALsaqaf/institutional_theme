"""Diagnosis only: which exception hides behind "500: There was an error building this page" under concurrent requests?

Runs in the bench environment (sites folder as the working directory):
    ../env/bin/python error_page_probe.py midad.test /about 4 150

Threads call the WSGI application of Frappe in one process, as the development web server does. The probe wraps
`frappe.website.serve.handle_exception` IN THIS PROCESS ONLY to print the exception that core otherwise turns into
the generic error page; nothing of core or of the app is changed on disk.
"""

import sys
import threading
import traceback

import frappe.website.serve as serve
from werkzeug.test import Client
from werkzeug.wrappers import Response

import frappe.app

site, path, workers, count = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
original = serve.handle_exception.__wrapped__ if hasattr(serve.handle_exception, "__wrapped__") else None
seen = []
lock = threading.Lock()
real = serve.handle_exception


def spy(e, endpoint, path, http_status_code):
	if not isinstance(e, (frappe.PageDoesNotExistError, frappe.Redirect, frappe.PermissionError)):
		with lock:
			seen.append("".join(traceback.format_exception(e))[-1800:])
	return real(e, endpoint, path, http_status_code)


serve.handle_exception = spy
statuses = {}


def work() -> None:
	client = Client(frappe.app.application, Response)
	for _ in range(count):
		response = client.get(path, headers={"X-Frappe-Site-Name": site, "Host": site})
		with lock:
			statuses[response.status_code] = statuses.get(response.status_code, 0) + 1


threads = [threading.Thread(target=work) for _ in range(workers)]
for t in threads:
	t.start()
for t in threads:
	t.join()
print("statuses:", statuses)
for text in seen[:3]:
	print("-" * 60)
	print(text)
print("exceptions seen:", len(seen))
