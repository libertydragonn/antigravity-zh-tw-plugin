#!/usr/bin/env bash
# Antigravity 中文化並啟動（macOS / Linux）
# 客戶端更新後用它：需要時自動重新注入，然後啟動客戶端
set -uo pipefail
cd "$(dirname "$0")"

PY=""
if command -v python3 >/dev/null 2>&1; then PY="python3";
elif command -v python >/dev/null 2>&1; then PY="python";
else
  echo "[ERR] 未找到 python3，請先安裝 Python 3.8+。"
  exit 1
fi

if ! "$PY" install.py --auto "$@"; then
  echo "[ERR] 啟動失敗，請檢視上方輸出。"
  exit 1
fi
