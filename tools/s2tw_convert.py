# -*- coding: utf-8 -*-
"""
把簡體中文版 Antigravity 中文化外掛轉換為繁體中文（臺灣用語）版。

用法：
    pip install opencc
    python tools/s2tw_convert.py <簡體版外掛資料夾> <輸出資料夾>

規則：
  - 使用 OpenCC s2twp（簡體 → 繁體臺灣標準 + 臺灣慣用詞）。
  - dicts/*.json 只轉換「值」，不動「鍵」——鍵是客戶端原始英文介面文字，
    少數鍵本身含有簡體字（例如外掛描述裡的觸發詞），改了就會比對不到。
  - 程式碼只轉換中日韓字元與中文字串裡的彎引號；ASCII 內容轉換前後必須完全一致，
    否則中止。
  - 正規表示式字元類別裡的彎引號（例如 [“"]）用來比對客戶端英文原文，保持不變。
  - 檔名與資料夾名稱裡的中文一併轉換，程式內引用到的檔名會用同一套規則轉換，前後一致。
"""
import json
import os
import re
import shutil
import sys

import opencc

CJK = re.compile(r"[㐀-䶿一-鿿豈-﫿]")
CONV = opencc.OpenCC("s2twp")

# 先在簡體文字上替換（OpenCC 轉換前）
PRE = [
    ("中文汉化", "中文化"),
    ("汉化", "中文化"),
    ("查找", "寻找"),      # Find → 尋找（避免 s2twp 轉成「查詢」與 Query 撞名）
    ("后台", "背景"),      # 後臺執行 → 背景執行
]

# 再在繁體結果上替換（OpenCC 轉換後），依序套用；第一欄為正規表示式
POST = [
    ("智慧體", "代理程式"),  # Agent；「代理」已用於 Proxy，改用「代理程式」避免歧義
    ("賬", "帳"),            # 帳號、帳戶
    ("釋出", "發布"),
    ("托盤", "系統匣"),
    ("快捷方式", "捷徑"),
    ("幻燈片", "投影片"),
    ("只讀(?!取|寫)", "唯讀"),  # read-only；「只讀取」「只讀寫」是「只」+動詞，保留
    ("許可權", "權限"),
    ("二進位制", "二進位"),      # s2twp 會把「权限」轉成「許可權」
    ("請訪問", "請造訪"),
    ("訪問", "存取"),
    ("收件箱", "收件匣"),
    ("自定義", "自訂"),
    ("倉庫", "存放庫"),
    ("質量", "品質"),
    ("用戶(?!端)", "使用者"),
    ("擴充套件程式", "擴充功能"),
    ("擴充套件", "擴充功能"),
    ("回撥", "回呼"),
    ("高階", "進階"),
    ("獲取", "取得"),
    ("構建", "建構"),
    ("分割槽", "分區"),
    ("終端(?!機)", "終端機"),
    # via → 透過；表示「通過（pass）」的保留：未通過、校驗通過、通過測試……
    ("(?<!未)(?<!校驗)(?<!驗證)(?<!檢查)(?<!測試)(?<!審核)(?<!審查)"
     "通過(?!認證|驗證|審核|審查|檢查|測試|了)", "透過"),
    ("併發(?=布|送)", "並發"),    # 「并发布」「并发送」被誤斷成「并发」（並行）
    ("隻(?=影響)", "只"),
    ("引數過載", "參數覆寫"),
    ("引數", "參數"),
    ("計算機", "電腦"),
    ("熱過載", "熱重載"),        # hot reload，不是 overload
    ("重灌", "重新安裝"),
    ("(Python |內建)執行時", r"\1執行環境"),  # runtime
]
POST = [(re.compile(a), b) for a, b in POST]

# 詞典檔名改為繁體版名稱（程式內的引用一併替換）
FILE_RENAMES = {"zh_cn.json": "zh_tw.json"}
NAME_REFS = [("zh_cn.json", "zh_tw.json"), ("zh-CN.json", "zh-TW.json")]

TEXT_EXT = {".py", ".js", ".json", ".md", ".txt", ".bat", ".sh", ".cmd"}
TEXT_NAMES = {"VERSION", "LICENSE"}
SKIP_DIRS = {"__pycache__", ".git"}

# 正規表示式字元類別中的彎引號，例如 [“"]、[”"]、[“”"]
QUOTE_CLASS = re.compile(r"\[[“”\"'‘’]+\]")


def convert_text(s):
    if not CJK.search(s):
        return s
    for a, b in PRE:
        s = s.replace(a, b)
    s = CONV.convert(s)
    for pat, b in POST:
        s = pat.sub(b, s)
    return s


def convert_quotes(s):
    """把中文字串裡的 “” 換成「」；已含「」時改用『』。"""
    if "“" not in s and "”" not in s:
        return s
    if s.count("“") != s.count("”"):
        return s
    if "「" in s or "」" in s:
        return s.replace("“", "『").replace("”", "』")
    return s.replace("“", "「").replace("”", "」")


def convert_code_quotes(text):
    """程式碼：保護正規表示式字元類別後，逐行把含中文的行內彎引號轉成「」。"""
    out = []
    for line in text.split("\n"):
        if ("“" in line or "”" in line) and CJK.search(line):
            kept = []

            def keep(m):
                kept.append(m.group(0))
                return "\x00%d\x00" % (len(kept) - 1)

            tmp = QUOTE_CLASS.sub(keep, line)
            tmp = tmp.replace("“", "「").replace("”", "」")
            line = re.sub(r"\x00(\d+)\x00", lambda m: kept[int(m.group(1))], tmp)
        out.append(line)
    return "\n".join(out)


def skeleton(s):
    """去掉中日韓字元與引號後的骨架，用來確認程式碼本身沒有被改動。"""
    s = CJK.sub("", s)
    for ch in "“”「」『』":
        s = s.replace(ch, "")
    return s


def convert_json_dict(src, dst):
    with open(src, "r", encoding="utf-8") as f:
        raw = f.read()
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise SystemExit("不支援的詞典格式: %s" % src)
    out = {}
    for k, v in data.items():
        out[k] = convert_quotes(convert_text(v)) if isinstance(v, str) else v
    if list(out.keys()) != list(data.keys()):
        raise SystemExit("詞典鍵被改動: %s" % src)
    text = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
    with open(dst, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    return len(out)


def convert_file(src, dst):
    with open(src, "r", encoding="utf-8", newline="") as f:
        raw = f.read()
    new = convert_text(raw)
    ext = os.path.splitext(src)[1].lower()
    if ext in (".js", ".py"):
        new = convert_code_quotes(new)
    else:
        new = convert_quotes_in_prose(new)
    if skeleton(raw) != skeleton(new):
        raise SystemExit("非中文內容被改動，已中止: %s" % src)
    for a, b in NAME_REFS:
        new = new.replace(a, b)
    with open(dst, "w", encoding="utf-8", newline="") as f:
        f.write(new)


def convert_quotes_in_prose(text):
    return "\n".join(convert_quotes(line) for line in text.split("\n"))


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 1
    src_root, dst_root = sys.argv[1], sys.argv[2]
    if os.path.exists(dst_root) and os.listdir(dst_root):
        raise SystemExit("輸出資料夾不是空的，請先清空或改用其他路徑: %s" % dst_root)
    for root, dirs, files in os.walk(src_root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel = os.path.relpath(root, src_root)
        out_dir = dst_root if rel == "." else os.path.join(
            dst_root, *[convert_text(p) for p in rel.split(os.sep)])
        os.makedirs(out_dir, exist_ok=True)
        for name in files:
            src = os.path.join(root, name)
            dst = os.path.join(out_dir, FILE_RENAMES.get(name, convert_text(name)))
            ext = os.path.splitext(name)[1].lower()
            if ext == ".json" and os.path.basename(root) == "dicts":
                n = convert_json_dict(src, dst)
                print("[dict] %s（%d 條）" % (os.path.relpath(dst, dst_root), n))
            elif ext in TEXT_EXT or name in TEXT_NAMES:
                convert_file(src, dst)
                print("[text] %s" % os.path.relpath(dst, dst_root))
            else:
                shutil.copy2(src, dst)
    return 0


if __name__ == "__main__":
    sys.exit(main())
