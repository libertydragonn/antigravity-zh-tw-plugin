# -*- coding: utf-8 -*-
"""
純 Python 實現的 asar 歸檔讀寫庫（零外部依賴）。
支援 extract / pack，相容 Electron 使用的 asar 格式，
含 unpacked 檔案（.asar.unpacked 目錄）的處理。

參考 @electron/asar 的實現約定：
- 檔案頭 16 位元組 pickle: <IIII> = (4, json_size+8, json_size+4, json_size)
- header 為緊湊 JSON（無多餘空格），UTF-8
- 目錄節點: {"files": {...}}；檔案節點: {"size": N, "offset": "123"}
- unpacked 檔案: {"size": N, "offset": "", "unpacked": true}，內容在 <asar>.unpacked 下
- executable 檔案額外標記 "executable": true
"""
import hashlib
import json
import os
import re
import struct
import sys

PICKLE_HEADER = struct.Struct("<IIII")
BLOCK_SIZE = 4 * 1024 * 1024  # integrity 分塊大小，與官方一致


def _file_integrity(data):
    """計算 asar integrity（與 @electron/asar 演算法一致）：
    hash=整檔案 SHA256，blocks=每 BLOCK_SIZE 一塊的 SHA256。
    """
    full = hashlib.sha256(data).hexdigest()
    blocks = []
    if not data:
        blocks.append(hashlib.sha256(data).hexdigest())
    for off in range(0, len(data), BLOCK_SIZE):
        blocks.append(hashlib.sha256(data[off:off + BLOCK_SIZE]).hexdigest())
    return {"algorithm": "SHA256", "hash": full, "blockSize": BLOCK_SIZE, "blocks": blocks}


def _glob_to_regex(pattern):
    """將支援 ** / * / ? 的 glob 模式轉換為正則（路徑以 / 分隔）。"""
    out = []
    i = 0
    n = len(pattern)
    while i < n:
        c = pattern[i]
        if c == "*":
            if i + 1 < n and pattern[i + 1] == "*":
                if i + 2 < n and pattern[i + 2] == "/":
                    out.append("(?:[^/]+/)*")
                    i += 3
                else:
                    out.append(".*")
                    i += 2
            else:
                out.append("[^/]*")
                i += 1
        elif c == "?":
            out.append("[^/]")
            i += 1
        elif c == "[":
            j = i + 1
            while j < n and pattern[j] != "]":
                j += 1
            cls = pattern[i + 1:j]
            out.append("[" + cls.replace("\\", "\\\\") + "]")
            i = j + 1 if j < n else n
        else:
            out.append(re.escape(c))
            i += 1
    return re.compile("^" + "".join(out) + "$")


def _match_unpack(relpath, patterns):
    if not patterns:
        return False
    for p in patterns:
        rx = _glob_to_regex(p)
        if rx.match(relpath):
            return True
    return False


def _is_executable(path):
    """按 @electron/asar 規則判斷是否標記 executable。"""
    if not os.access(path, os.X_OK):
        return False
    if path.endswith((".js", ".json", ".html", ".css", ".png", ".txt",
                      ".yml", ".map", ".bnf", ".ts", ".md", ".svg")):
        return False
    return True


def _build_tree(src_dir):
    """建構 asar header 的 files 樹；返回 (header, [(abspath, node, relpath)])。"""
    header = {"files": {}}
    file_list = []

    for root, dirs, files in os.walk(src_dir):
        # 穩定順序：目錄和檔案都排序
        dirs.sort()
        files.sort()
        rel_root = os.path.relpath(root, src_dir)
        if rel_root == ".":
            rel_root = ""
        curr = header
        if rel_root:
            for part in rel_root.split(os.sep):
                curr = curr.setdefault("files", {}).setdefault(part, {"files": {}})
        for f in files:
            fp = os.path.join(root, f)
            rel = os.path.relpath(fp, src_dir).replace(os.sep, "/")
            node = {"size": os.path.getsize(fp)}
            if _is_executable(fp):
                node["executable"] = True
            curr.setdefault("files", {})[f] = node
            file_list.append((fp, node, rel))
    return header, file_list


def pack(src_dir, dest_asar, unpack_patterns=None, exact_unpack=None):
    """
    將 src_dir 打包為 dest_asar。
    匹配 unpack_patterns（glob 列表）或位於 exact_unpack（精確相對路徑集合）中的檔案
    寫入 dest_asar.unpacked 目錄，header 中標記 unpacked: true 且 offset 為空。
    exact_unpack 用於「保持原 asar 的 unpacked 集合不變」，避免新版本新增的
    原生模組被錯誤打進 asar 導致 require 失敗。
    """
    unpack_patterns = unpack_patterns or []
    exact_unpack = exact_unpack or set()
    header, file_list = _build_tree(src_dir)

    unpacked_root = dest_asar + ".unpacked"
    current_offset = 0
    for fp, node, rel in file_list:
        if rel in exact_unpack or _match_unpack(rel, unpack_patterns):
            node["unpacked"] = True
            # 內容寫入 .unpacked 目錄
            target = os.path.join(unpacked_root, rel)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            _copy_file(fp, target)
            if node.get("executable"):
                os.chmod(target, os.stat(target).st_mode | 0o111)
            with open(target, "rb") as src:
                node["integrity"] = _file_integrity(src.read())
        else:
            node["offset"] = str(current_offset)
            with open(fp, "rb") as src:
                node["integrity"] = _file_integrity(src.read())
            current_offset += node["size"]

    json_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    json_size = len(json_bytes)
    # 官方將 JSON 補齊到 4 位元組對齊，header pickle 總長 = 8 + align4(json_size)
    pad = (-json_size) % 4
    json_padded = json_bytes + b"\x00" * pad
    pickle_size = 8 + len(json_padded)
    os.makedirs(os.path.dirname(dest_asar) or ".", exist_ok=True)
    with open(dest_asar, "wb") as f:
        f.write(struct.pack("<II", 4, pickle_size))
        f.write(struct.pack("<II", 4 + len(json_padded), json_size))
        f.write(json_padded)
        # 按序遍歷寫入檔案資料（unpacked 跳過）
        for fp, node, rel in file_list:
            if node.get("unpacked"):
                continue
            with open(fp, "rb") as src:
                while True:
                    chunk = src.read(65536)
                    if not chunk:
                        break
                    f.write(chunk)
    return dest_asar


def _read_header(asar_path):
    """讀取 asar header，返回 (header_dict, json_size, header_pickle_size)。
    檔案佈局：
      [0:4]   uint32 = 4（size pickle 的 payload 長度）
      [4:8]   uint32 = header pickle 總長 = 8 + align4(json_len)
      [8:12]  uint32 = header pickle payload 長 = 4 + align4(json_len)
      [12:16] int32  = JSON 字串長度
      [16:16+json_len] JSON 字串，其後補齊到 4 位元組對齊
    資料區起點 = 8 + header_pickle_size。
    """
    with open(asar_path, "rb") as f:
        head = f.read(8)
        if len(head) != 8:
            raise ValueError("無效的 asar 檔案頭")
        v, pickle_size = struct.unpack("<II", head)
        # v 是外層 size pickle 的 payload 長度（Chromium Pickle 約定，恆為 4），
        # 並非格式版本號；pickle_size 為 header pickle 總長，需在合理範圍內
        if v != 4 or pickle_size < 8 or pickle_size > 64 * 1024 * 1024:
            raise ValueError("無效的 asar 檔案頭")
        f.seek(12)
        len_bytes = f.read(4)
        if len(len_bytes) != 4:
            raise ValueError("asar header 讀取不完整")
        json_size = struct.unpack("<i", len_bytes)[0]
        f.seek(16)
        data = f.read(json_size)
        if len(data) != json_size:
            raise ValueError("asar header 讀取不完整")
        return json.loads(data.decode("utf-8")), json_size, pickle_size


def _data_offset(pickle_size, file_offset):
    """將 header 中檔案的相對偏移轉換為檔案內的絕對偏移（資料區起點 = 8 + pickle_size）。"""
    return 8 + pickle_size + int(file_offset)


def extract(asar_path, dest_dir, with_unpacked=True):
    """
    將 asar 解包到 dest_dir。
    unpacked 檔案：若 with_unpacked 為 True，則從 <asar>.unpacked 複製。
    """
    header, json_size, pickle_size = _read_header(asar_path)
    unpacked_root = asar_path + ".unpacked"
    count = 0

    def walk(node, rel):
        nonlocal count
        for name, child in node.get("files", {}).items():
            child_rel = rel + "/" + name if rel else name
            if "files" in child:  # 目錄 -> 遞迴
                walk(child, child_rel)
                continue
            out_path = os.path.join(dest_dir, *child_rel.split("/"))
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            if child.get("unpacked"):
                if with_unpacked:
                    src_path = os.path.join(unpacked_root, *child_rel.split("/"))
                    if os.path.exists(src_path):
                        _copy_file(src_path, out_path)
                        count += 1
                    else:
                        # unpacked 檔案缺失時建立空佔位，避免結構破壞
                        open(out_path, "wb").close()
                        count += 1
                else:
                    open(out_path, "wb").close()
                    count += 1
            else:
                with open(asar_path, "rb") as f:
                    f.seek(_data_offset(pickle_size, child["offset"]))
                    data = f.read(child["size"])
                with open(out_path, "wb") as f:
                    f.write(data)
                if child.get("executable"):
                    os.chmod(out_path, os.stat(out_path).st_mode | 0o111)
                count += 1

    walk(header, "")
    return count


def list_files(asar_path):
    """列出 asar 內所有檔案（相對路徑）。"""
    header, _json_size, _pickle_size = _read_header(asar_path)
    out = []

    def walk(node, rel):
        for name, child in node.get("files", {}).items():
            child_rel = rel + "/" + name if rel else name
            if "files" in child:
                walk(child, child_rel)
            else:
                out.append((child_rel, child.get("size", 0), child.get("unpacked", False)))

    walk(header, "")
    return out


def _copy_file(src, dst):
    with open(src, "rb") as fsrc, open(dst, "wb") as fdst:
        while True:
            chunk = fsrc.read(65536)
            if not chunk:
                break
            fdst.write(chunk)



def read_file(asar_path, relpath):
    """從 asar 中讀取單個檔案內容（packed 從資料區讀，unpacked 從同級 .unpacked 讀）。"""
    header, json_size, pickle_size = _read_header(asar_path)
    parts = relpath.replace("\\", "/").strip("/").split("/")
    node = header
    for part in parts:
        node = node.get("files", {}).get(part)
        if node is None:
            raise FileNotFoundError(relpath)
    rel = "/".join(parts)
    if node.get("unpacked"):
        src = os.path.join(asar_path + ".unpacked", *parts)
        if not os.path.exists(src):
            raise FileNotFoundError(relpath)
        with open(src, "rb") as f:
            return f.read()
    with open(asar_path, "rb") as f:
        f.seek(_data_offset(pickle_size, node["offset"]))
        return f.read(node["size"])


def read_json(asar_path, relpath):
    import json as _json
    return _json.loads(read_file(asar_path, relpath).decode("utf-8"))


def file_count(asar_path):
    return len(list_files(asar_path))


if __name__ == "__main__":
    # 命令列自檢：python3 asar.py <extract|pack|list> ...
    cmd = sys.argv[1]
    if cmd == "extract":
        n = extract(sys.argv[2], sys.argv[3])
        print("extracted %d files" % n)
    elif cmd == "pack":
        pack(sys.argv[2], sys.argv[3], sys.argv[4:] or None)
        print("packed -> %s" % sys.argv[3])
    elif cmd == "list":
        for rel, size, unp in list_files(sys.argv[2]):
            print("%s\t%s\t%s" % (rel, size, "unpacked" if unp else ""))
