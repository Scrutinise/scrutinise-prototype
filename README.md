# Scrutinise Web

---

## Claude Code setup

`CLAUDE.md` at the repo root is auto-read by Claude Code on every session start and after `/clear`. It points Claude to the four key docs to read before touching any code. No manual prompt needed — just start the session.

If Claude hasn't read the docs (e.g. after a long context compaction), say: **"read CLAUDE.md"** to re-trigger.

---

## Dev environment notes

### Git temp files — desktop vs laptop

**Desktop (Windows, D: drive):** The C: drive is near capacity. Git temp files (index writes during commits) are redirected to `D:/tmp` via `GIT_TMPDIR=D:/tmp`, set permanently in `~/.bashrc` and `~/.bash_profile`. Claude Code also applies this in any git commands it runs.

**Laptop (Windows, C: drive only):** The Dropbox/GitHub folder sits on C:. Do NOT set `GIT_TMPDIR` — git can write its temp files to C: normally. If Claude Code sessions are started from the laptop, it should omit the `GIT_TMPDIR` prefix on commits.

If you see `fatal: unable to write new index file` on the desktop, it means C: is full and `GIT_TMPDIR` is not set for that shell session — run `export GIT_TMPDIR="D:/tmp"` to fix it for that session.
