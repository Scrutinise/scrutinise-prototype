#!/bin/sh
# Expand $PORT and bind to 0.0.0.0
PORT="${PORT:-3000}"
exec next start -H 0.0.0.0 --port "$PORT"
