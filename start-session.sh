#!/bin/bash
echo "=== SESSION START: $(date) ===" >> session-log.txt
echo "Branch: $(git branch --show-current)" >> session-log.txt
git status
echo "Session logged to session-log.txt"
