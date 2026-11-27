# 上游來源

- 專案：[WhiteBr1ck/agy-powertools](https://github.com/WhiteBr1ck/agy-powertools)（MIT，見 `LICENSE`；日曆元件授權見 `lib/vendor/NOTICE.txt`）
- 版本：v2.16.12（正式發布包 `agy-powertools-v2.16.12.zip`，SHA-256 `ea504fec7c32d0f4fad212ee577fe42a531347d55fbe47fd4f4f43698c3a7498`）
- 由 `tools/vendor_powertools.py` 原樣解出，未做任何修改；請勿手動修改本資料夾。

## 與本外掛的關係

Powertools 是**選用**元件，預設不安裝。雙擊外掛根目錄的「安裝 Powertools.bat」才會呼叫本資料夾的 `scripts/install.mjs` 安裝到 `~/.gemini/config/plugins/agy-powertools/`；「移除 Powertools.bat」會呼叫 `scripts/uninstall.mjs --keep-settings`。
