# 上游來源

- 專案：[elviscjn-cjn/antigravity-context-viewer](https://github.com/elviscjn-cjn/antigravity-context-viewer)（MIT，見 `LICENSE`、`THIRD_PARTY_NOTICES.md`）
- 版本：v0.9.3（commit `c057717d1fc2cbe15ae0ce59287877d054eed4c2`）
- 由 `tools/vendor_context_viewer.py` 產生，請勿手動修改本資料夾。

## 繁體中文相容修補

看板以 aria-label / 按鈕文字定位 Antigravity 介面元素，上游只比對英文與簡體。本外掛把介面翻成繁體，因此在下列比對處**追加**繁體寫法（原有英文、簡體比對全部保留）：

| 位置 | 追加的繁體比對 |
| --- | --- |
| 權限模式按鈕 | 權限、極速 |
| 傳送按鈕 | `aria-label*="傳送"` |
| 麥克風 / 語音按鈕 | `aria-label*="麥克風"`、`aria-label*="語音"` |
| 自訂擴充功能分頁 | `aria-label*="自訂"` |
| 開啟 IDE 按鈕（3 處） | `開啟 IDE` |

未包含上游的 `install.bat` / `uninstall.bat` / `install.sh` / `uninstall.sh` 與未簽章的 `scripts/cli-window-helper.exe`（上游說明：缺少時 CLI 啟動會自動改用標準 cmd 視窗，功能不受影響）。安裝、移除請使用外掛根目錄的批次檔。
