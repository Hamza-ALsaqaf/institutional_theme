"""Continuous read load on one site while the test suite runs: the desk (logged in), the login page and website pages.

    python3 load.py <base-url> <log-file> <stop-file> [workers]

Each worker loops over the paths until <stop-file> exists. Every request is one log line:
    <iso time> <worker> <status> <seconds> <path>
A summary of counts by path and status is written to <log-file>.summary when the load stops.
Only GET requests, plus one login POST per worker at the start. The site's data is never written.
"""

import collections
import http.cookiejar
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

base, log_path, stop_path = sys.argv[1], sys.argv[2], sys.argv[3]
workers = int(sys.argv[4]) if len(sys.argv) > 4 else 3
PATHS = [
	"/desk",
	"/login",
	"/",
	"/desk/todo",
	"/login?redirect-to=%2Fdesk",
	"/contact",
	"/api/method/ping",
	"/desk",
	"/update-password",
]
lock = threading.Lock()
counts: collections.Counter = collections.Counter()
log = open(log_path, "a", buffering=1)


def record(worker: int, status, seconds: float, path: str) -> None:
	with lock:
		counts[(path, status)] += 1
		log.write(f"{datetime.now(timezone.utc).isoformat(timespec='milliseconds')} {worker} {status} {seconds:.3f} {path}\n")


def make_opener() -> urllib.request.OpenerDirector:
	jar = http.cookiejar.CookieJar()
	return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def fetch(opener, worker: int, path: str, data: bytes | None = None):
	started = time.monotonic()
	status = "error"
	try:
		request = urllib.request.Request(base + path, data=data)
		with opener.open(request, timeout=60) as response:
			response.read()
			status = response.status
	except urllib.error.HTTPError as error:
		status = error.code
	except Exception as error:
		status = type(error).__name__
	record(worker, status, time.monotonic() - started, path)
	return status


def run(worker: int) -> None:
	opener = make_opener()
	data = urllib.parse.urlencode({"usr": "Administrator", "pwd": "admin"}).encode()
	fetch(opener, worker, "/api/method/login", data)
	index = worker
	while not os.path.exists(stop_path):
		fetch(opener, worker, PATHS[index % len(PATHS)])
		index += 1
		time.sleep(0.05)


threads = [threading.Thread(target=run, args=(n,)) for n in range(workers)]
for thread in threads:
	thread.start()
for thread in threads:
	thread.join()
total = sum(counts.values())
with open(log_path + ".summary", "w") as summary:
	summary.write(f"requests: {total}\n")
	by_status: collections.Counter = collections.Counter()
	for (path, status), n in sorted(counts.items(), key=lambda item: (item[0][0], str(item[0][1]))):
		by_status[status] += n
		summary.write(f"{n:6d}  {status}  {path}\n")
	summary.write("by status: " + ", ".join(f"{k}: {v}" for k, v in sorted(by_status.items(), key=lambda i: str(i[0]))) + "\n")
