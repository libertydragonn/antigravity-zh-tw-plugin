#!/usr/bin/env bash
# Antigravity 一鍵中文化（macOS / Linux）
# v1.5.0：注入後自動啟動；macOS/Linux 不執行冒煙測試（Windows 專有）
set -uo pipefail
cd "$(dirname "$0")"

echo "============================================"
echo "  Antigravity 一鍵中文化"
echo "============================================"

PY=""
if command -v python3 >/dev/null 2>&1; then PY="python3";
elif command -v python >/dev/null 2>&1; then PY="python";
else
  echo "[ERR] 未找到 python3，請先安裝 Python 3.8+。"
  exit 1
fi

echo "[*] 注入中文化（需要時自動備份官方原版）..."
if ! "$PY" install.py --launch "$@"; then
  echo "[ERR] 安裝失敗，請檢視上方錯誤資訊。"
  echo "      若提示備份版本不一致，請先重新執行本指令碼生成當前版本備份。"
  exit 1
fi

echo "[OK] 完成。客戶端更新後，執行 ./launch-macos.sh 或重新執行本指令碼即可快速恢復中文化。"
