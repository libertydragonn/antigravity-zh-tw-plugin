#!/usr/bin/env bash
# Antigravity 還原官方原版（macOS / Linux）
# v1.5.0：會校驗備份版本與當前客戶端是否一致，不一致拒絕還原
set -uo pipefail
cd "$(dirname "$0")"

echo "============================================"
echo "  Antigravity 還原官方原版"
echo "============================================"

PY=""
if command -v python3 >/dev/null 2>&1; then PY="python3";
elif command -v python >/dev/null 2>&1; then PY="python";
else
  echo "[ERR] 未找到 python3，請先安裝 Python 3.8+。"
  exit 1
fi

"$PY" install.py --restore "$@"
code=$?
if [ "$code" -ne 0 ]; then
  echo "[ERR] 還原失敗（退出碼 $code）。"
  echo "      退出碼 4 表示沒有與當前客戶端版本匹配的官方備份（保護機制）。"
  echo "      解決辦法：先執行 ./install-macos.sh 生成當前版本備份，再還原。"
  exit "$code"
fi

echo "[OK] 下次啟動即為官方英文原版。"
