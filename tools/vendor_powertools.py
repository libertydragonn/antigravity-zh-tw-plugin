# -*- coding: utf-8 -*-
"""
把 WhiteBr1ck/agy-powertools（Agy Powertools，MIT）的正式發布包放進本存放庫的 powertools/。

用法：
    gh release download vX.Y.Z --repo WhiteBr1ck/agy-powertools --pattern "agy-powertools-vX.Y.Z.zip"
    python tools/vendor_powertools.py agy-powertools-vX.Y.Z.zip

說明：
  - 只接受上游 Release 的 zip（內含 plugin.json，name 必須是 agy-powertools），原樣解出，不做修改。
  - Powertools 是 Antigravity 的原生外掛：安裝到 ~/.gemini/config/plugins/agy-powertools/，
    透過本機除錯連接埠掛載介面，不改 app.asar；本外掛只負責呼叫它的安裝 / 解除安裝程式。
"""
import hashlib
import json
import os
import shutil
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(os.path.dirname(HERE), "powertools")


def main():
    if len(sys.argv) != 2 or not sys.argv[1].endswith(".zip"):
        print(__doc__)
        return 1
    src = os.path.abspath(sys.argv[1])
    digest = hashlib.sha256(open(src, "rb").read()).hexdigest()
    with zipfile.ZipFile(src) as z:
        if z.testzip() is not None:
            raise SystemExit("zip 損壞")
        names = [n for n in z.namelist() if not n.endswith("/")]
        roots = {n.split("/")[0] for n in names}
        if len(roots) != 1:
            raise SystemExit("zip 結構不符（應只有一個頂層資料夾）")
        root = roots.pop() + "/"
        manifest = json.loads(z.read(root + "plugin.json").decode("utf-8"))
        if manifest.get("name") != "agy-powertools":
            raise SystemExit("不是 agy-powertools 的發布包")
        version = json.loads(z.read(root + "package.json").decode("utf-8")).get("version", "?")
        for n in names:
            rel = n[len(root):]
            if not rel or ".." in rel.split("/") or rel.startswith("/"):
                raise SystemExit("zip 內含不安全路徑: %s" % n)
        if os.path.isdir(DEST):
            shutil.rmtree(DEST)
        for n in names:
            d = os.path.join(DEST, *n[len(root):].split("/"))
            os.makedirs(os.path.dirname(d), exist_ok=True)
            with z.open(n) as fsrc, open(d, "wb") as fdst:
                shutil.copyfileobj(fsrc, fdst)
    with open(os.path.join(DEST, "UPSTREAM.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(
            "# 上游來源\n\n"
            "- 專案：[WhiteBr1ck/agy-powertools](https://github.com/WhiteBr1ck/agy-powertools)（MIT，見 `LICENSE`；"
            "日曆元件授權見 `lib/vendor/NOTICE.txt`）\n"
            "- 版本：v%s（正式發布包 `%s`，SHA-256 `%s`）\n"
            "- 由 `tools/vendor_powertools.py` 原樣解出，未做任何修改；請勿手動修改本資料夾。\n\n"
            "## 與本外掛的關係\n\n"
            "Powertools 是**選用**元件，預設不安裝。雙擊外掛根目錄的「安裝 Powertools.bat」才會呼叫本資料夾的 "
            "`scripts/install.mjs` 安裝到 `~/.gemini/config/plugins/agy-powertools/`；"
            "「移除 Powertools.bat」會呼叫 `scripts/uninstall.mjs --keep-settings`。\n"
            % (version, os.path.basename(src), digest))
    print("[OK] agy-powertools v%s -> %s（%d 個檔案）" % (version, DEST, len(names)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
