# Round 3 bench, second attempt (fresh GitHub Actions runner, 2026-10-14)

VERIFIED 00:47 UTC: the runner of the second attempt is a new machine, so the bench was rebuilt.

- `sudo -E` keeps the environment but `sudo` still resets PATH (secure_path), so the first try found no `uv` and no Python 3.14 (`EXIT 1`). The scripts are run with `sudo env "PATH=$PATH" …` (`docs/team/evidence/round3/DISPATCH.md`).
- `tools/bench/ci_prereqs.sh`: playwright-core and the Pillow venv (`prereqs.log`).
- `tools/bench/build_test_bench.sh`: EXIT 0, TOTAL 265 s (`bench-build.log`).
- `b.sh install-app institutional_theme` EXIT 0, `b.sh build --app institutional_theme` EXIT 0, `start_services.sh` (`install.log`); `/api/method/ping` returns pong.
- `list-apps` in `list-apps.txt`.
