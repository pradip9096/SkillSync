#!/bin/bash
# ==========================================
# SkillSync Auto-Start Wrapper
# ==========================================

exec "$(dirname "$0")/scripts/start.sh" "$@"
