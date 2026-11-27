# -*- coding: utf-8 -*-
"""
把 elviscjn-cjn/antigravity-context-viewer（對話上下文檢視器與 Token 用量看板）
的執行檔案複製到本存放庫的 context-viewer/，並套用繁體中文相容修補。

用法：
    git clone https://github.com/elviscjn-cjn/antigravity-context-viewer.git <上游目錄>
    python tools/vendor_context_viewer.py <上游目錄>

為什麼需要修補：
    看板會用 aria-label / 按鈕文字定位 Antigravity 的部分介面元素，
    上游只比對英文與簡體（例如「发送」「麦克风」「自定义」「打开 IDE」）。
    本外掛會把這些標籤翻成繁體（傳送、麥克風、自訂、開啟 IDE），
    所以在每個比對處「追加」繁體寫法；原本的英文與簡體比對全部保留。
    每一處修補都必須剛好命中預期次數，否則中止（代表上游程式碼已變動，需要重新檢查）。
"""
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(os.path.dirname(HERE), "context-viewer")

# 與上游 scripts/package-release.js 的發布清單一致（不含 .bat/.sh 啟動器與預編譯 .exe）
FILES = [
    "cli.js", "install.js", "restore.js", "live-host.js", "host-recovery.js", "local-api.js",
    "meter-main.js", "meter-core.js", "meter-renderer.js", "meter-collector.js", "meter-storage.js",
    "meter-proxy.js", "meter-cli-launcher.js", "meter-cli-monitor.js", "meter-cli-adapter.js",
    "meter-cli-companion.js", "meter-cli-ui.js", "meter-context-unlock.js", "meter-enhance.js",
    "meter-rehydrate.js", "meter-accounts.js", "meter-next-prompt.js", "autostart.js",
    "macos-binary-utils.js", "attachment_scan.py", "asar-engine.js", "modules-config.js",
    "modular-installer.js",
    "i18n/zh-CN.json", "i18n/i18n-runtime.js",
    "rehydrate/README.md", "rehydrate/rehydrate_after_compact.py",
    "unlock/README.md", "unlock/language-server/README.md",
    "unlock/language-server/patch-language_server.py",
    "unlock/agy-cli/README.md", "unlock/agy-cli/README-Windows.md", "unlock/agy-cli/FINDINGS.md",
    "unlock/agy-cli/agy-patch.py", "unlock/agy-cli/apply.sh", "unlock/agy-cli/verify_tui.py",
    "package.json", "README.md", "README.en.md", "README.ja.md", "README.ko.md", "README.es.md",
    "AGENTS.md", "THIRD_PARTY_NOTICES.md", "LICENSE",
]

# (檔案, 原字串, 新字串, 預期命中次數)
PATCHES = [
    ("meter-renderer.js",
     r"/permission|极速|权限|fast\b|local\b|auto\b/i",
     r"/permission|极速|权限|極速|權限|fast\b|local\b|auto\b/i", 1),
    ("meter-renderer.js",
     r"/permission|极速|权限/i",
     r"/permission|极速|权限|極速|權限/i", 1),
    ("meter-renderer.js",
     'button[aria-label*="发送"]',
     'button[aria-label*="发送"], button[aria-label*="傳送"]', 1),
    ("meter-renderer.js",
     'button[aria-label*="麦克风"]',
     'button[aria-label*="麦克风"], button[aria-label*="麥克風"], button[aria-label*="語音"]', 1),
    ("meter-renderer.js",
     '[aria-label*="自定义"].active',
     '[aria-label*="自定义"].active, [aria-label*="自訂"].active', 1),
    ("meter-renderer.js",
     "text === '打开 IDE' || text.includes('Open IDE') || text.includes('打开 IDE')",
     "text === '打开 IDE' || text === '開啟 IDE' || text.includes('Open IDE') "
     "|| text.includes('打开 IDE') || text.includes('開啟 IDE')", 3),
]


def git_rev(src):
    try:
        return subprocess.run(["git", "-C", src, "rev-parse", "HEAD"], capture_output=True,
                              text=True, check=True).stdout.strip()
    except Exception:
        return "unknown"


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    src = os.path.abspath(sys.argv[1])
    if not os.path.isfile(os.path.join(src, "cli.js")):
        raise SystemExit("不是 antigravity-context-viewer 的目錄: %s" % src)
    if os.path.isdir(DEST):
        shutil.rmtree(DEST)
    for rel in FILES:
        s = os.path.join(src, *rel.split("/"))
        if not os.path.isfile(s):
            raise SystemExit("上游缺少檔案: %s" % rel)
        d = os.path.join(DEST, *rel.split("/"))
        os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.copyfile(s, d)

    for rel, old, new, expect in PATCHES:
        p = os.path.join(DEST, rel)
        with open(p, "r", encoding="utf-8", newline="") as f:
            text = f.read()
        n = text.count(old)
        if n != expect:
            raise SystemExit("修補比對次數不符（%s：預期 %d，實際 %d）：%s" % (rel, expect, n, old))
        with open(p, "w", encoding="utf-8", newline="") as f:
            f.write(text.replace(old, new))
        print("[patch] %s ×%d" % (rel, n))

    import json
    with open(os.path.join(src, "package.json"), encoding="utf-8") as f:
        version = json.load(f).get("version", "?")
    rev = git_rev(src)
    with open(os.path.join(DEST, "UPSTREAM.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(
            "# 上游來源\n\n"
            "- 專案：[elviscjn-cjn/antigravity-context-viewer](https://github.com/elviscjn-cjn/antigravity-context-viewer)（MIT，見 `LICENSE`、`THIRD_PARTY_NOTICES.md`）\n"
            "- 版本：v%s（commit `%s`）\n"
            "- 由 `tools/vendor_context_viewer.py` 產生，請勿手動修改本資料夾。\n\n"
            "## 繁體中文相容修補\n\n"
            "看板以 aria-label / 按鈕文字定位 Antigravity 介面元素，上游只比對英文與簡體。"
            "本外掛把介面翻成繁體，因此在下列比對處**追加**繁體寫法（原有英文、簡體比對全部保留）：\n\n"
            "| 位置 | 追加的繁體比對 |\n| --- | --- |\n"
            "| 權限模式按鈕 | 權限、極速 |\n"
            "| 傳送按鈕 | `aria-label*=\"傳送\"` |\n"
            "| 麥克風 / 語音按鈕 | `aria-label*=\"麥克風\"`、`aria-label*=\"語音\"` |\n"
            "| 自訂擴充功能分頁 | `aria-label*=\"自訂\"` |\n"
            "| 開啟 IDE 按鈕（3 處） | `開啟 IDE` |\n\n"
            "未包含上游的 `install.bat` / `uninstall.bat` / `install.sh` / `uninstall.sh` 與未簽章的 "
            "`scripts/cli-window-helper.exe`（上游說明：缺少時 CLI 啟動會自動改用標準 cmd 視窗，功能不受影響）。"
            "安裝、移除請使用外掛根目錄的批次檔。\n" % (version, rev))
    print("[OK] context-viewer v%s (%s) -> %s" % (version, rev[:7], DEST))
    return 0


if __name__ == "__main__":
    sys.exit(main())
