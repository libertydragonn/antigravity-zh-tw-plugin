# -*- coding: utf-8 -*-
"""
Antigravity 中文化安裝器 v1.7.0（純 Python 零依賴）
====================================================
為 Google Antigravity 桌面客戶端注入中文翻譯引擎。

v1.7.0 設計要點（安全第一 + 全面適配 2.35.1）：
- 只向入口檔案末尾【追加】帶 BEGIN/END 標記的補丁塊，不改動官方原有程式碼；
  更新注入時按成對 BEGIN/END 標記精準替換，完整保留第三方補丁（如貓娘外掛）。
  每個補丁塊整體 try/catch 包裹，任何補丁自身出錯都不會影響客戶端啟動。
- 安裝後自動冒煙測試：真啟動一次客戶端並確認能起來；失敗自動回滾官方原版。
- 還原前校驗備份與當前客戶端版本是否一致，避免把舊版 asar 還原到新客戶端。
- --auto：客戶端更新後雙擊一次即可自動重新中文化並啟動（已中文化則秒開）。

用法：
    python install.py                 # 安裝中文化（含冒煙測試與自動啟動）
    python install.py --auto          # 智慧模式：需要時才重新中文化，然後啟動
    python install.py --auto-silent   # 需要時重新中文化，不啟動（供開機任務用）
    python install.py --launch        # 安裝後啟動客戶端
    python install.py --no-smoke      # 跳過冒煙測試（不推薦）
    python install.py --restore       # 還原官方原版（校驗版本）
    python install.py --status        # 檢視狀態
    python install.py --install-task  # 註冊登入時自動修復任務
    python install.py --remove-task   # 移除登入時自動修復任務
    python install.py --asar PATH     # 手動指定 app.asar 路徑

說明：本工具修改本地 app.asar，非 Google 官方語言包。客戶端自動更新後中文化會
消失，雙擊「中文化並啟動.bat」或重新執行本指令碼即可恢復。
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import asar  # noqa: E402

TOOLKIT_VERSION = "1.7.0"
TAG = "Antigravity Chinese Translation Injection v5-appendonly"
DICT_PLACEHOLDER = "__DICT_ITEMS__"
ENGINE_START_MARKER = "(function() {\n  const dictionary = {"
UNPACK_PATTERNS = ["**/node_modules/chrome-devtools-mcp/**"]

BLOCK_BEGIN = "// ===== AG_ZH_BEGIN:%s ====="
BLOCK_END = "// ===== AG_ZH_END:%s ====="
BLOCK_BEGIN_PREFIX = "// ===== AG_ZH_BEGIN:"
BLOCK_PAIR_RE = re.compile(
    r"\n?// ===== AG_ZH_BEGIN:[^\n]+ =====[\s\S]*?// ===== AG_ZH_END:[^\n]+ =====\n?"
)
LEGACY_MARKERS = [
    "// ===== Antigravity Chinese Translation Injection v3-full =====",
    "// ===== Antigravity Chinese Translation Injection v2-extra =====",
    "// ===== Antigravity Chinese Translation Injection v4-appendonly =====",
    "const menuTranslationMap = {",
]
LEGACY_MENU_CALL = "if (typeof translateMenu === 'function') { menu.items.forEach(translateMenu); } "

USER_DIR = os.path.join(os.path.expanduser("~"), ".antigravity-zh")
BACKUP_DIR = os.path.join(USER_DIR, "backup")
BACKUP_ASAR = os.path.join(BACKUP_DIR, "app.asar.orig")
BACKUP_META = os.path.join(BACKUP_DIR, "meta.json")
STATE_FILE = os.path.join(USER_DIR, "state.json")
EXT_DICT = os.path.join(USER_DIR, "zh-TW.json")
LOG_DIR = os.path.join(USER_DIR, "logs")
TASK_NAME = "AntigravityZhAutoRepair"
APP_EXE_NAMES = ["Antigravity.exe"]
# 登入時自動修復：寫 HKCU Run 登錄檔項（無需管理員權限；
# 啟動資料夾裡的 .bat 會被安全軟體攔截，登錄檔 Run 更穩）
REG_RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
REG_VALUE_NAME = "AntigravityZhAutoRepair"
# 舊方案殘留（v1.5.0 早期測試用），清理用
LEGACY_STARTUP_DIR = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")),
                                  "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
LEGACY_STARTUP_FILE = os.path.join(LEGACY_STARTUP_DIR, "AntigravityZhAutoRepair.bat")

_LOG_PATH = None


def toolkit_version():
    try:
        with open(os.path.join(HERE, "VERSION"), "r", encoding="utf-8") as f:
            return f.read().strip() or TOOLKIT_VERSION
    except Exception:
        return TOOLKIT_VERSION


def setup_log():
    global _LOG_PATH
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        _LOG_PATH = os.path.join(LOG_DIR, "install-%s.log" % time.strftime("%Y%m%d-%H%M%S"))
        with open(_LOG_PATH, "w", encoding="utf-8") as f:
            f.write("Antigravity 中文化安裝器 v%s\n" % toolkit_version())
            f.write("time: %s\nplatform: %s\npython: %s\n\n" % (
                time.strftime("%Y-%m-%d %H:%M:%S"), sys.platform, sys.version.replace("\n", " ")))
    except Exception:
        _LOG_PATH = None


def say(msg=""):
    print(msg)
    if _LOG_PATH:
        try:
            with open(_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(str(msg) + "\n")
        except Exception:
            pass


def die(msg, code=1):
    say("")
    say("[ERR] " + msg)
    if _LOG_PATH:
        say("[i] 詳細日誌: " + _LOG_PATH)
    sys.exit(code)


def read_text(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_text(path, content):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------- 平臺與路徑
def detect_paths(asar_path=None):
    if asar_path:
        if not os.path.exists(asar_path):
            die("指定的 app.asar 不存在: %s" % asar_path)
        return os.path.abspath(asar_path), os.path.dirname(os.path.abspath(asar_path))

    candidates = []
    if sys.platform == "darwin":
        candidates = [
            "/Applications/Antigravity.app/Contents/Resources/app.asar",
            os.path.expanduser("~/Applications/Antigravity.app/Contents/Resources/app.asar"),
        ]
    elif sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA", "")
        candidates = [
            os.path.join(base, "Programs", "Antigravity", "resources", "app.asar"),
            os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "Antigravity", "resources", "app.asar"),
        ]
    elif sys.platform.startswith("linux"):
        candidates = [
            "/opt/Antigravity/resources/app.asar",
            os.path.expanduser("~/.local/share/Antigravity/resources/app.asar"),
        ]
    for c in candidates:
        if c and os.path.exists(c):
            return c, os.path.dirname(c)
    die("未找到 Antigravity app.asar。\n"
        "      macOS: /Applications/Antigravity.app\n"
        "      Windows: %%LOCALAPPDATA%%\\Programs\\Antigravity\n"
        "      或使用 --asar 手動指定路徑。")


def app_exe_path(resources_dir=None):
    if sys.platform == "darwin":
        if resources_dir:
            return os.path.dirname(os.path.dirname(resources_dir))
        return "/Applications/Antigravity.app"
    if sys.platform.startswith("linux"):
        return "/opt/Antigravity/Antigravity"
    if resources_dir:
        app_root = os.path.dirname(resources_dir)
        exe = os.path.join(app_root, "Antigravity.exe")
        if os.path.exists(exe):
            return exe
    for base in (os.environ.get("LOCALAPPDATA", ""),
                 os.environ.get("ProgramFiles", ""),
                 os.environ.get("ProgramFiles(x86)", "")):
        if not base:
            continue
        exe = os.path.join(base, "Programs", "Antigravity", "Antigravity.exe")
        if not os.path.exists(exe):
            exe = os.path.join(base, "Antigravity", "Antigravity.exe")
        if os.path.exists(exe):
            return exe
    return None


def is_app_running():
    try:
        if sys.platform == "darwin":
            r = subprocess.run(["pgrep", "-f", "Antigravity.app/Contents/MacOS"], capture_output=True)
            return r.returncode == 0
        if sys.platform == "win32":
            r = subprocess.run(["tasklist", "/FI", "IMAGENAME eq Antigravity.exe"],
                               capture_output=True, text=True, encoding="utf-8", errors="ignore")
            return "Antigravity.exe" in (r.stdout or "")
        r = subprocess.run(["pgrep", "-x", "Antigravity"], capture_output=True)
        return r.returncode == 0
    except Exception:
        return False


def kill_app(wait_seconds=20):
    if not is_app_running():
        return True
    say("[*] 正在關閉 Antigravity ...")
    try:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/IM", "Antigravity.exe", "/F", "/T"],
                           capture_output=True, text=True, encoding="utf-8", errors="ignore")
        elif sys.platform == "darwin":
            subprocess.run(["pkill", "-f", "Antigravity.app/Contents/MacOS"], capture_output=True)
        else:
            subprocess.run(["pkill", "-x", "Antigravity"], capture_output=True)
    except Exception:
        pass
    deadline = time.time() + wait_seconds
    while time.time() < deadline:
        if not is_app_running():
            time.sleep(1.0)  # 留時間給系統釋放檔案控制代碼
            return True
        time.sleep(0.5)
    return not is_app_running()


def start_app(exe):
    if not exe:
        return False
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", "-a", exe], close_fds=True)
            return True
        env = os.environ.copy()
        for k in ("ELECTRON_RUN_AS_NODE", "NODE_USE_ENV_PROXY", "ELECTRON_NO_ATTACH_CONSOLE"):
            env.pop(k, None)
        flags = 0
        if sys.platform == "win32":
            flags = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
        subprocess.Popen([exe], env=env, close_fds=True, creationflags=flags,
                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception as e:
        say("[!] 啟動客戶端失敗: %s" % e)
        return False


def app_log_path():
    if sys.platform == "win32":
        return os.path.join(os.environ.get("APPDATA", ""), "Antigravity", "logs", "main.log")
    if sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support/Antigravity/logs/main.log")
    return os.path.expanduser("~/.config/Antigravity/logs/main.log")


def _read_from_offset(path, offset):
    try:
        if not os.path.exists(path):
            return ""
        size = os.path.getsize(path)
        if size <= offset:
            return ""
        with open(path, "rb") as f:
            f.seek(offset)
            return f.read().decode("utf-8", "ignore")
    except Exception:
        return ""


def smoke_test(exe, timeout=60):
    """真啟動一次客戶端，確認能正常起來。返回 (ok, reason)。成功時客戶端保持執行。"""
    if sys.platform != "win32":
        return True, "非 Windows 平臺跳過冒煙測試"
    if not exe:
        return False, "找不到 Antigravity.exe"
    log = app_log_path()
    try:
        offset = os.path.getsize(log) if os.path.exists(log) else 0
    except Exception:
        offset = 0
    say("[*] 冒煙測試：啟動客戶端驗證（最多 %d 秒）..." % timeout)
    if not start_app(exe):
        return False, "啟動失敗"
    deadline = time.time() + timeout
    seen_start = False
    stable_since = None
    while time.time() < deadline:
        if not is_app_running():
            return False, "客戶端程序啟動後退出"
        if not seen_start:
            chunk = _read_from_offset(log, offset)
            if "Starting app (v" in chunk:
                seen_start = True
                stable_since = time.time()
        if seen_start and stable_since and (time.time() - stable_since) >= 6:
            if is_app_running():
                return True, "客戶端已正常啟動"
            return False, "客戶端啟動後又退出"
        time.sleep(1.0)
    if seen_start:
        return False, "客戶端啟動後不穩定"
    return False, "等待超時（未看到啟動日誌）"


# ---------------------------------------------------------------- 詞典與引擎
def load_dictionary():
    d = {}
    dict_path = os.path.join(HERE, "dicts", "zh_tw.json")
    if not os.path.exists(dict_path):
        die("找不到字典檔案: %s" % dict_path)
    with open(dict_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        d.update(data)
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and "key" in item and "value" in item:
                d[item["key"]] = item["value"]
    if not d:
        die("字典為空")
    return d


def dictionary_sha(dictionary):
    payload = json.dumps(dictionary, ensure_ascii=False, sort_keys=True,
                         separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def load_engine_template():
    p = os.path.join(HERE, "dicts", "engine.js")
    if not os.path.exists(p):
        die("找不到引擎模板: %s" % p)
    return read_text(p)


def build_engine_block(dictionary):
    items = []
    for k, v in dictionary.items():
        items.append("    %s: %s" % (json.dumps(k, ensure_ascii=False),
                                     json.dumps(v, ensure_ascii=False)))
    dict_block = "// ===== %s =====\n  const extraDict = {\n%s\n  };\n" % (
        TAG, ",\n".join(items))
    engine = load_engine_template().replace(DICT_PLACEHOLDER, dict_block)
    return ("try {\n" + engine.rstrip() + "\n} catch (e) {\n"
            "  try { console.error('[Antigravity-ZH] 引擎初始化失敗', e); } catch (_) {}\n"
            "}")


MENU_LABELS = {
    "File": "檔案", "Edit": "編輯", "View": "檢視", "Workspace": "工作區",
    "Window": "視窗", "Help": "幫助", "New": "新建", "New Window": "新建視窗", "New Conversation": "新建對話",
    "Docs": "使用文件", "Documentation": "使用文件", "Toggle Developer Tools": "開發者工具",
    "Check for Updates": "檢查更新", "Checking for Updates...": "正在檢查更新...",
    "Downloading Update...": "正在下載更新...", "Restart to Update": "重啟以應用更新",
    "Undo": "撤銷", "Redo": "重做", "Cut": "剪下", "Copy": "複製", "Paste": "貼上",
    "Paste and Match Style": "貼上並匹配樣式", "Select All": "全選",
    "Minimize": "最小化", "Close": "關閉", "Quit": "退出",
    "Quit Antigravity": "退出 Antigravity", "About Antigravity": "關於 Antigravity",
    "Services": "服務", "Hide Antigravity": "隱藏 Antigravity", "Hide Others": "隱藏其他",
    "Show All": "顯示全部", "Force Reload": "強制重新載入", "Reload": "重新載入",
    "Actual Size": "實際大小", "Zoom In": "放大", "Zoom Out": "縮小",
    "Toggle Full Screen": "切換全屏", "Settings": "設定", "Settings...": "設定...",
    "Preferences": "偏好設定", "Preferences...": "偏好設定...", "Exit": "退出",
    "No agents running": "沒有代理程式在執行", "Open Antigravity": "開啟 Antigravity",
    "Learn More": "瞭解更多", "Show Logs": "顯示日誌", "Reload Window": "重新載入視窗",
    "New Agent": "新建代理程式", "Open Settings": "開啟設定", "Export": "匯出",
    "Import": "匯入", "Remove": "移除", "Delete": "刪除", "Delete Permanently": "永久刪除",
    "Rename": "重新命名", "Duplicate": "建立副本",
    "Select Project": "選擇專案", "Open Folder": "開啟資料夾", "Open Terminal": "開啟終端機",
    "Connect to WSL": "連線到 WSL", "Reopen Locally": "在本地重新開啟",
    "Connect to SSH Host": "連線到 SSH 主機", "Connect to SSH Host…": "連線到 SSH 主機…",
    "Switch to This Computer": "切換到此電腦", "SSH Config": "SSH 配置",
    "Start New Chat": "開始新對話",
    # 對話與窗格右鍵上下文選單（2.34.0 showContextMenu）
    "Pin": "置頂", "Unpin": "取消置頂",
    "Pin This Conversation": "置頂此對話", "Unpin This Conversation": "取消置頂此對話",
    "Pin Entire Project": "置頂整個專案", "Unpin Project": "取消置頂專案",
    "Pin Entire Workspace": "置頂整個工作區", "Unpin Workspace": "取消置頂工作區",
    "Pin Entire Worktree": "置頂整個工作樹", "Unpin Worktree": "取消置頂工作樹",
    "Mark Read": "標為已讀", "Mark Unread": "標為未讀",
    "Mark as Read": "標為已讀", "Mark as Unread": "標為未讀",
    "View Debug": "檢視除錯資訊",
    "Move to Group": "移動到分組", "New Group": "新建分組", "Remove from Group": "從分組中移除",
    "Conversation Name": "對話名稱", "Conversation ID": "對話 ID",
    "Workspace Name": "工作區名稱", "Worktree Name": "工作樹名稱", "Project Name": "專案名稱",
    "Fork": "分叉", "Fork Conversation": "分叉對話",
    "Split": "分屏", "Split Right": "向右分屏", "Split Down": "向下分屏",
    "Split Left": "向左分屏", "Split Up": "向上分屏",
    "Replace with New": "替換為新建對話", "Remove from Split": "從分屏中移除",
    "Share": "共享", "Stop": "停止",
    "Archive": "歸檔", "Unarchive": "取消歸檔", "Restore": "恢復",
    "Telemetry": "遙測",
    # 標籤頁 / 瀏覽器 / 連結 / 檢視右鍵選單
    "Pin Tab": "固定標籤頁", "Unpin Tab": "取消固定標籤頁",
    "Keep Open": "保持開啟", "Auto Pin": "自動置頂",
    "Close Tab": "關閉標籤頁", "Close Other Tabs": "關閉其他標籤頁",
    "Close All Tabs": "關閉全部標籤頁", "Close Tabs to the Right": "關閉右側標籤頁",
    "Side Panel": "側邊欄", "Built-in Browser": "內建瀏覽器",
    "External Browser": "外部瀏覽器", "System Browser": "系統瀏覽器",
    "Open in Side Panel": "在側邊欄中開啟", "Open in Browser": "在瀏覽器中開啟",
    "Open in Built-in Browser": "在內建瀏覽器中開啟", "Open in External Browser": "在外部瀏覽器中開啟",
    "Open in System Browser": "在系統瀏覽器中開啟", "Open in New Tab": "在新標籤頁中開啟",
    "Open Link": "開啟連結", "Copy Link": "複製連結", "Copy Link Address": "複製連結地址",
    "Copy Image": "複製圖片", "Copy Image Address": "複製圖片地址",
    "Copy Path": "複製路徑", "Copy Relative Path": "複製相對路徑",
    "Link Settings": "連結設定", "Download image": "下載圖片", "Download video": "下載影片",
    "Save Image As...": "圖片另存為...",
    "Reveal in File Explorer": "在檔案資源管理器中顯示", "Reveal in Finder": "在訪達中顯示",
    "Show in Folder": "在資料夾中顯示", "Open in Terminal": "在終端機中開啟",
    "Toggle Word Wrap": "切換自動換行", "Inspect": "檢查", "Inspect Element": "檢查元素",
    "Refresh all credentials": "重新整理全部憑據", "Refreshing credentials...": "正在重新整理憑據...",
    "Show Automation Conversations": "顯示自動化對話",
    "Show Plugin Conversations": "顯示外掛對話",
    "Idle Conversations": "空閒對話",
    "Side Question Selection": "選區側邊提問", "Reply": "回覆",
    "Connection info…": "連線資訊…", "Connection info": "連線資訊",
    "View MCP servers": "檢視 MCP 伺服器",
    "Speech": "語音", "Start Speaking": "開始朗讀", "Stop Speaking": "停止朗讀",
    "Back": "後退", "Forward": "前進", "Refresh": "重新整理",
}
MENU_ROLES = {
    "undo": "撤銷", "redo": "重做", "cut": "剪下", "copy": "複製", "paste": "貼上",
    "selectAll": "全選", "reload": "重新載入", "forceReload": "強制重新載入",
    "toggleDevTools": "開發者工具", "resetZoom": "實際大小", "zoomIn": "放大",
    "zoomOut": "縮小", "togglefullscreen": "切換全屏", "minimize": "最小化",
    "close": "關閉", "quit": "退出", "about": "關於", "services": "服務",
    "hide": "隱藏", "hideOthers": "隱藏其他", "unhide": "顯示全部",
    "front": "前置全部視窗", "newWindow": "新建視窗", "window": "視窗",
    "help": "幫助", "file": "檔案", "edit": "編輯", "view": "檢視",
}
DIALOG_LABELS = {
    "Confirm Quit": "確認退出", "Are you sure you want to quit?": "您確定要退出嗎？",
    "There may be agents or background tasks running.": "可能還有代理程式或背景任務正在執行。",
    "Quit": "退出", "Cancel": "取消", "OK": "確定", "Save": "儲存",
    "Don't Save": "不儲存", "Yes": "是", "No": "否", "Continue": "繼續",
    "Error": "錯誤", "Warning": "警告", "Antigravity": "Antigravity",
    "Connect a device": "連線裝置",
    "Folder is on the Windows filesystem": "資料夾位於 Windows 檔案系統中",
    "Cannot open folder": "無法開啟資料夾",
    "Open workspace": "開啟工作區",
    "Open workspaces": "開啟工作區",
    "Select Download Folder": "選擇下載資料夾",
    "WSL distro not found": "未找到 WSL 發行版",
    "Antigravity opened on Windows instead.": "已改為在 Windows 上開啟 Antigravity。",
    "Couldn't connect to the SSH host. See the app log.": "無法連線到 SSH 主機，請檢視應用日誌。",
    "Choose an SSH config file": "選擇 SSH 配置檔案",
    "Choose another SSH config file": "選擇其他 SSH 配置檔案",
    "Choose Another File…": "選擇其他檔案…",
    "SSH connection failed": "SSH 連線失敗",
    "Could not restart the SSH server": "無法重啟 SSH 伺服器",
    "Stop SSH server": "停止 SSH 伺服器",
    "Stop Server": "停止伺服器",
    "Agents running on this host will stop and its window will close.": "此主機上執行的代理程式將停止，且其視窗將會關閉。",
    "Agents running on this host will stop and its window will close. The server starts again the next time you connect.": "此主機上執行的代理程式將停止，且其視窗將會關閉。下次連線時伺服器會重新啟動。",
    "Reconnect first, then stop its server.": "請先重新連線，然後再停止其伺服器。",
    "Binary not found": "未找到執行檔",
    "WSL setup failed": "WSL 配置失敗",
    "Startup failed": "啟動失敗",
    "Passkeys": "通行金鑰",
    "Unknown device": "未知裝置",
    "Browser control action failed": "瀏覽器控制操作失敗",
    "Failed to stop agent browser": "停止代理程式瀏覽器失敗",
    "Take control failed": "接管控制失敗",
    "Capture session failed": "捕獲會話失敗",
    "Microphone access": "麥克風權限",
    "Allow": "允許",
    "Don't Allow": "不允許",
    "Sign in": "登入",
    "Sign In": "登入",
    "Shared home directory": "共享主目錄",
    "Take Over": "接管",
    "Restart SSH server": "重啟 SSH 伺服器",
    "Restart": "重啟",
    "Later": "稍後",
    "Check for Updates": "檢查更新",
    "No updates available": "當前已是最新版本",
    "Choose a Passkey": "選擇通行金鑰 (Passkey)",
    "Select a passkey account to continue:": "選擇一個通行金鑰帳號以繼續：",
    "Connection info": "連線資訊",
    "The connection was closed before it finished.": "連線在完成前已關閉。",
}


def _js_map(d):
    parts = []
    for k in d:
        parts.append("    %s: %s" % (json.dumps(k, ensure_ascii=False), json.dumps(d[k], ensure_ascii=False)))
    return "{\n" + ",\n".join(parts) + "\n  }"


MENU_PATCH_JS = """(function () {
  try {
    var electron = require('electron');
    var Menu = electron && electron.Menu;
    if (!Menu || Menu.__AG_ZH_MENU__) return;
    var LABELS = __MENU_LABELS__;
    var ROLES = __MENU_ROLES__;
    var EXT_DICT = Object.create(null);
    var EXT_DICT_LOWER = Object.create(null);
    var REVERSE_UPDATER = {
      '檢查更新': 'Check for Updates',
      '正在檢查更新...': 'Checking for Updates...',
      '正在下載更新...': 'Downloading Update...',
      '重啟以應用更新': 'Restart to Update'
    };

    function loadExternalMenuDict() {
      try {
        var fs = require('fs');
        var os = require('os');
        var path = require('path');
        var extPath = path.join(os.homedir(), '.antigravity-zh', 'zh-TW.json');
        if (!fs.existsSync(extPath)) return;
        var raw = fs.readFileSync(extPath, 'utf-8');
        var parsed = JSON.parse(raw);
        var items = parsed.translations || parsed;
        var next = Object.create(null);
        var nextLow = Object.create(null);
        for (var k in items) {
          if (!Object.prototype.hasOwnProperty.call(items, k)) continue;
          if (k.indexOf('__') === 0 || typeof items[k] !== 'string') continue;
          next[k] = items[k];
          var lk = k.toLowerCase();
          if (!Object.prototype.hasOwnProperty.call(nextLow, lk)) nextLow[lk] = items[k];
        }
        EXT_DICT = next;
        EXT_DICT_LOWER = nextLow;
      } catch (e) {}
    }

    loadExternalMenuDict();
    try {
      var fsW = require('fs');
      var osW = require('os');
      var pathW = require('path');
      var extWatch = pathW.join(osW.homedir(), '.antigravity-zh', 'zh-TW.json');
      if (fsW.existsSync(extWatch)) {
        var timer = null;
        fsW.watch(extWatch, { persistent: false }, function () {
          if (timer) clearTimeout(timer);
          timer = setTimeout(loadExternalMenuDict, 200);
        });
      }
    } catch (e) {}

    function joinCn(prefix, rest) {
      if (!rest) return prefix;
      return /^[A-Za-z0-9]/.test(rest) ? prefix + ' ' + rest : prefix + rest;
    }

    function tr(s, depth) {
      if (typeof s !== 'string' || !s) return s;
      depth = depth || 0;
      if (depth > 3) return s;
      if (Object.prototype.hasOwnProperty.call(LABELS, s)) return LABELS[s];
      var m = /^(\\d+)\\s+(?:active\\s+)?agents?\\s+running$/i.exec(s);
      if (m) return m[1] + ' 個代理程式執行中';
      m = /^(\\d+)\\s+active\\s+agents?$/i.exec(s);
      if (m) return m[1] + ' 個代理程式執行中';
      m = /^(.+?)\\s+\\(Default\\)$/i.exec(s);
      if (m) return tr(m[1], depth + 1) + '（預設）';
      m = /^Open in (.+)$/i.exec(s);
      if (m) return '在 ' + tr(m[1], depth + 1) + ' 中開啟';
      m = /^Pin Entire (.+)$/i.exec(s);
      if (m) return joinCn('置頂整個', tr(m[1], depth + 1));
      m = /^Unpin (.+)$/i.exec(s);
      if (m) return joinCn('取消置頂', tr(m[1], depth + 1));
      m = /^Copy (.+)$/i.exec(s);
      if (m) return joinCn('複製', tr(m[1], depth + 1));
      m = /^Move to (.+)$/i.exec(s);
      if (m) return joinCn('移動到', tr(m[1], depth + 1));
      m = /^Remove (.+) from Recent$/i.exec(s);
      if (m) return '從最近記錄中移除 ' + m[1];
      m = /^Search Google for [“"](.+)[”"]$/i.exec(s);
      if (m) return '在 Google 中搜索「' + m[1] + '」';
      m = /^Switch to (.+)$/i.exec(s);
      if (m) return joinCn('切換到', tr(m[1], depth + 1));
      m = /^Connect to (.+)$/i.exec(s);
      if (m) return joinCn('連線到', tr(m[1], depth + 1));
      m = /^Open (.+)$/i.exec(s);
      if (m) return '開啟 ' + tr(m[1], depth + 1);
      if (Object.prototype.hasOwnProperty.call(EXT_DICT, s)) return EXT_DICT[s];
      var low = s.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(EXT_DICT_LOWER, low)) return EXT_DICT_LOWER[low];
      return s;
    }

    function walk(item) {
      if (!item || typeof item !== 'object') return;
      try {
        if (typeof item.label === 'string' && item.label) {
          item.label = tr(item.label, 0);
        } else if (!item.label && typeof item.role === 'string' && ROLES[item.role]) {
          item.label = ROLES[item.role];
        }
        if (item.id === 'check-for-updates' && typeof item.click === 'function' && !item.click.__AG_ZH_UPDATER__) {
          var origClick = item.click;
          var wrappedClick = function (mi) {
            if (mi && typeof mi.label === 'string' && Object.prototype.hasOwnProperty.call(REVERSE_UPDATER, mi.label)) {
              try { mi.label = REVERSE_UPDATER[mi.label]; } catch (e) {}
            }
            try { return origClick.apply(this, arguments); }
            finally {
              if (mi && typeof mi.label === 'string') {
                try { mi.label = tr(mi.label, 0); } catch (e) {}
              }
            }
          };
          wrappedClick.__AG_ZH_UPDATER__ = true;
          item.click = wrappedClick;
        }
        var sub = item.submenu;
        if (sub && typeof sub === 'object') {
          if (Array.isArray(sub)) sub.forEach(walk);
          else if (Array.isArray(sub.items)) sub.items.forEach(walk);
        }
      } catch (e) {}
    }

    var origSet = Menu.setApplicationMenu;
    if (typeof origSet === 'function') {
      Menu.setApplicationMenu = function (menu) {
        try { if (menu && Array.isArray(menu.items)) menu.items.forEach(walk); } catch (e) {}
        return origSet.apply(this, arguments);
      };
    }
    var origBuild = Menu.buildFromTemplate;
    if (typeof origBuild === 'function') {
      Menu.buildFromTemplate = function (template) {
        try { if (Array.isArray(template)) template.forEach(walk); } catch (e) {}
        return origBuild.apply(this, arguments);
      };
    }
    var Tray = electron && electron.Tray;
    if (Tray && Tray.prototype && typeof Tray.prototype.setContextMenu === 'function' && !Tray.prototype.__AG_ZH_TRAY__) {
      var origTraySet = Tray.prototype.setContextMenu;
      Tray.prototype.setContextMenu = function (menu) {
        try { if (menu && Array.isArray(menu.items)) menu.items.forEach(walk); } catch (e) {}
        return origTraySet.apply(this, arguments);
      };
      Tray.prototype.__AG_ZH_TRAY__ = true;
    }
    Menu.__AG_ZH_MENU__ = true;
  } catch (e) {
    try { console.error('[Antigravity-ZH] 選單補丁失敗', e); } catch (_) {}
  }
})();"""

DIALOG_PATCH_JS = """(function () {
  try {
    var electron = require('electron');
    var dialog = electron && electron.dialog;
    if (!dialog || dialog.__AG_ZH_DIALOG__) return;
    var LABELS = __DIALOG_LABELS__;
    function tr(s) {
      if (typeof s !== 'string' || !s) return s;
      if (Object.prototype.hasOwnProperty.call(LABELS, s)) return LABELS[s];
      var t = s.trim();
      if (Object.prototype.hasOwnProperty.call(LABELS, t)) return LABELS[t];
      var m = /^The WSL distro "(.+)" is no longer installed\\.$/.exec(t);
      if (m) return 'WSL 發行版「' + m[1] + '」已不再安裝。';
      m = /^(.+) wants to connect to a (.+)$/.exec(t);
      if (m) {
        var kind = m[2] === 'USB device' ? ' USB 裝置' : (m[2] === 'serial port' ? '序列埠' : ' ' + m[2]);
        return m[1] + ' 想要連線到' + kind;
      }
      m = /^Stop the Antigravity server on (.+)\\?$/.exec(t);
      if (m) return '要停止 ' + m[1] + ' 上的 Antigravity 伺服器嗎？';
      m = /^Not connected to (.+)$/.exec(t);
      if (m) return '未連線到 ' + m[1];
      m = /^Allow (.+) to use your microphone\\?$/.exec(t);
      if (m) return '允許 ' + m[1] + ' 使用您的麥克風嗎？';
      m = /^Sign in to your organization for (.+)\\?$/.exec(t);
      if (m) return '要登入 ' + m[1] + ' 對應的組織帳號嗎？';
      m = /^Finish this sign-in on (.+)\\?$/.exec(t);
      if (m) return '要在 ' + m[1] + ' 上完成此次登入嗎？';
      m = /^Sign in to (.+)$/.exec(t);
      if (m) return '登入到 ' + m[1];
      m = /^(.+) is running server ([^;]+);\\s*this app is ([^.]+)\\.\\s*Restart the server now\\?$/.exec(t);
      if (m) return m[1] + ' 正在執行伺服器 ' + m[2] + '；當前應用版本為 ' + m[3] + '。是否立即重啟伺服器？';
      m = /^(.+) still runs Antigravity server ([^.]+)\\.?$/.exec(t);
      if (m) return m[1] + ' 仍在執行 Antigravity 伺服器 ' + m[2] + '。';
      m = /^(.+) can't be the SSH config file$/.exec(t);
      if (m) return m[1] + ' 不能用作 SSH 配置檔案';
      m = /^SSH:\\s*(.+)$/.exec(t);
      if (m) return 'SSH：' + m[1];
      m = /^The page in this window comes from (.+?)\\.\\s*If you allow it,\\s*([\\s\\S]+)$/.exec(t);
      if (m) return '此視窗中的頁面來自 ' + m[1] + '。如果允許，該頁面將可以使用您的麥克風。';
      m = /^Any (.+?) still running on it stops\\.\\s*The server starts again with this app's version\\.$/.exec(t);
      if (m) return '其上仍在執行的任務將會停止，隨後伺服器將以當前應用版本重新啟動。';
      m = /^Continue only if you just chose to sign in with your organization in this window\\.\\s*(.+?)\\s+will get access to your organization's Google Cloud account\\.[\\s\\S]*$/i.exec(t);
      if (m) return '僅當您剛才主動選擇在此視窗中使用組織帳號登入時才繼續。' + m[1] + ' 將獲得您組織的 Google Cloud 帳號存取權限。';
      m = /^Continue only if you just chose to sign in from the (.+?) window\\.\\s*Your browser opens the sign-in page; once you sign in,\\s*(.+?)\\s+gets access to that account\\.$/i.exec(t);
      if (m) return '僅當您剛才主動選擇從 ' + m[1] + ' 視窗登入時才繼續。瀏覽器將開啟登入頁面；登入完成後，' + m[2] + ' 將獲得該帳號的存取權限。';
      return s;
    }
    function patchOptions(o) {
      try {
        if (!o || typeof o !== 'object') return;
        if (typeof o.title === 'string') o.title = tr(o.title);
        if (typeof o.message === 'string') o.message = tr(o.message);
        if (typeof o.detail === 'string') o.detail = tr(o.detail);
        if (typeof o.checkboxLabel === 'string') o.checkboxLabel = tr(o.checkboxLabel);
        if (typeof o.buttonLabel === 'string') o.buttonLabel = tr(o.buttonLabel);
        if (Array.isArray(o.buttons)) o.buttons = o.buttons.map(tr);
      } catch (e) {}
    }
    function argOptions(a, b) {
      if (b && typeof b === 'object') return b;
      if (a && typeof a === 'object') return a;
      return null;
    }
    var names = ['showMessageBox', 'showMessageBoxSync', 'showOpenDialog', 'showOpenDialogSync',
                 'showSaveDialog', 'showSaveDialogSync', 'showErrorBox'];
    for (var i = 0; i < names.length; i++) {
      try {
        var name = names[i];
        var fn = dialog[name];
        if (typeof fn !== 'function') continue;
        dialog[name] = (function (orig, fnName) {
          return function (a, b) {
            try { patchOptions(argOptions(a, b)); } catch (e) {}
            if (fnName === 'showErrorBox') {
              try { return orig.call(this, tr(a), tr(b)); } catch (e) {}
            }
            return orig.apply(this, arguments);
          };
        })(fn, name);
      } catch (e) {}
    }
    dialog.__AG_ZH_DIALOG__ = true;
  } catch (e) {
    try { console.error('[Antigravity-ZH] 對話方塊補丁失敗', e); } catch (_) {}
  }
})();"""


def build_menu_block():
    js = MENU_PATCH_JS.replace("__MENU_LABELS__", _js_map(MENU_LABELS))
    return js.replace("__MENU_ROLES__", _js_map(MENU_ROLES))


def build_dialog_block():
    return DIALOG_PATCH_JS.replace("__DIALOG_LABELS__", _js_map(DIALOG_LABELS))


# ---------------------------------------------------------------- 注入與清理
def _truncate_tail(content, markers):
    idx = -1
    for m in markers:
        if not m:
            continue
        i = content.find(m)
        if i >= 0 and (idx < 0 or i < idx):
            idx = i
    if idx >= 0:
        content = content[:idx]
    return content.rstrip() + "\n"


def apply_blocks(path, blocks, engine=False):
    """清除舊注入塊（保留第三方外掛塊）後，把 blocks 以標記塊形式追加到檔案末尾。"""
    content = read_text(path)
    content = content.replace(LEGACY_MENU_CALL, "")
    content = BLOCK_PAIR_RE.sub("\n", content)
    markers = [BLOCK_BEGIN_PREFIX] + LEGACY_MARKERS
    if engine:
        markers = markers + [ENGINE_START_MARKER]
    if any(m and m in content for m in markers):
        content = _truncate_tail(content, markers)
    else:
        content = content.rstrip() + "\n"
    for name, body in blocks:
        content += "\n" + (BLOCK_BEGIN % name) + "\n" + body.rstrip() + "\n" + (BLOCK_END % name) + "\n"
    write_text(path, content)
    return content


def patch_loading_overlay(tmp):
    path = os.path.join(tmp, "dist", "loadingOverlay.js")
    if not os.path.exists(path):
        say("[!] loadingOverlay.js 不存在，跳過載入畫面翻譯")
        return False
    content = read_text(path)
    snippet = '正在載入 Antigravity'
    if "AG_ZH_LOADING" in content:
        # 從簡體版升級時，把舊的載入提示文字換成繁體版
        marked = re.compile(r'<div class="text">[^<]*</div> <!-- AG_ZH_LOADING -->')
        new_tag = '<div class="text">' + snippet + '</div> <!-- AG_ZH_LOADING -->'
        if marked.search(content) and new_tag not in content:
            write_text(path, marked.sub(lambda m: new_tag, content, count=1))
            say("[OK] 載入畫面提示已更新為繁體中文")
        else:
            say("[*] loadingOverlay.js 已含中文載入提示，跳過")
        return True
    for bad in ("$", "`", "\\"):
        if bad in snippet:
            say("[!] 載入提示文本包含危險字元，跳過")
            return False
    old = '<div class="text">Loading Antigravity</div>'
    if old in content:
        content = content.replace(old, '<div class="text">' + snippet + '</div> <!-- AG_ZH_LOADING -->', 1)
        write_text(path, content)
        say("[OK] 載入畫面翻譯完成")
        return True
    if "</svg>" in content:
        css_anchor = "  @keyframes logo-pulse {"
        text_css = "  .text { margin-top: 16px; font-size: 14px; letter-spacing: 0.02em; opacity: 0.7; }\n"
        if ".text {" not in content and css_anchor in content:
            content = content.replace(css_anchor, text_css + css_anchor, 1)
        content = content.replace("</svg>", "</svg>\n  <div class=\"text\">" + snippet +
                                  "</div> <!-- AG_ZH_LOADING -->", 1)
        write_text(path, content)
        say("[OK] 載入畫面翻譯完成")
        return True
    say("[!] loadingOverlay.js 錨點未匹配，跳過載入畫面翻譯")
    return False


# ---------------------------------------------------------------- 備份與還原
def save_persistent_backup(asar_path, app_version=""):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    shutil.copy2(asar_path, BACKUP_ASAR)
    meta = {
        "app_version": app_version,
        "toolkit_version": toolkit_version(),
        "size": os.path.getsize(asar_path),
        "sha256": sha256(asar_path),
        "saved_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    with open(BACKUP_META, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    return meta


def read_meta():
    try:
        with open(BACKUP_META, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def safe_asar_version(path):
    try:
        return asar.read_json(path, "package.json").get("version", "") or ""
    except Exception:
        return ""


INJECTION_NEEDLES = [
    TAG.encode("utf-8"),
    b"AG_ZH_BEGIN:engine",
    b"Antigravity Chinese Translation Injection",
    b"Antigravity-ZH",
]


def quick_is_patched(path):
    """判斷 asar 是否被本外掛（任意歷史版本）注入過。"""
    needles = INJECTION_NEEDLES
    try:
        with open(path, "rb") as f:
            tail = b""
            while True:
                chunk = f.read(1 << 20)
                if not chunk:
                    return False
                buf = tail + chunk
                for n in needles:
                    if n in buf:
                        return True
                tail = buf[-64:]
    except OSError:
        return False


def load_state():
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(app_version, dict_sha, asar_sha):
    data = {
        "app_version": app_version,
        "dict_sha256": dict_sha,
        "injected_sha256": asar_sha,
        "injected_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "toolkit_version": toolkit_version(),
    }
    os.makedirs(USER_DIR, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------- 原子替換
def swap_in(asar_path, new_asar):
    stage = asar_path + ".agzh_new"
    unpacked = asar_path + ".unpacked"
    new_unpacked = new_asar + ".unpacked"
    keep_asar = asar_path + ".agzh_keep.asar"
    keep_unpacked = asar_path + ".unpacked.agzh_old"

    if os.path.exists(keep_asar):
        os.remove(keep_asar)
    if os.path.isdir(keep_unpacked):
        shutil.rmtree(keep_unpacked, ignore_errors=True)
    shutil.copy2(asar_path, keep_asar)
    shutil.copy2(new_asar, stage)

    if os.path.isdir(unpacked):
        os.rename(unpacked, keep_unpacked)
    if os.path.isdir(new_unpacked):
        shutil.move(new_unpacked, unpacked)
    try:
        os.replace(stage, asar_path)
    except Exception:
        if os.path.isdir(unpacked):
            shutil.rmtree(unpacked, ignore_errors=True)
        if os.path.isdir(keep_unpacked):
            os.rename(keep_unpacked, unpacked)
        if os.path.exists(keep_asar):
            os.remove(keep_asar)
        raise
    finally:
        if os.path.exists(stage):
            os.remove(stage)
    return {"keep_asar": keep_asar,
            "keep_unpacked": keep_unpacked if os.path.isdir(keep_unpacked) else None}


def finalize_swap(state):
    try:
        if state.get("keep_asar") and os.path.exists(state["keep_asar"]):
            os.remove(state["keep_asar"])
    except Exception:
        pass
    try:
        if state.get("keep_unpacked") and os.path.isdir(state["keep_unpacked"]):
            shutil.rmtree(state["keep_unpacked"], ignore_errors=True)
    except Exception:
        pass


def rollback_swap(asar_path, state):
    keep_asar = state.get("keep_asar")
    keep_unpacked = state.get("keep_unpacked")
    if not keep_asar or not os.path.exists(keep_asar):
        return False
    stage = asar_path + ".agzh_restore"
    shutil.copy2(keep_asar, stage)
    if keep_unpacked and os.path.isdir(keep_unpacked):
        unpacked = asar_path + ".unpacked"
        if os.path.isdir(unpacked):
            shutil.rmtree(unpacked, ignore_errors=True)
        os.rename(keep_unpacked, unpacked)
    os.replace(stage, asar_path)
    if os.path.exists(keep_asar):
        os.remove(keep_asar)
    return True


# ---------------------------------------------------------------- 安裝主流程
def original_unpacked_set(asar_path):
    """讀取原 asar 中被標記為 unpacked 的檔案集合（唯讀頭，很快）。"""
    try:
        return set(rel for rel, size, unp in asar.list_files(asar_path) if unp)
    except Exception:
        return set()


def extract_and_prepare(asar_path):
    tmp = tempfile.mkdtemp(prefix="agy_zh_")
    try:
        asar.extract(asar_path, tmp)
    except Exception as e:
        shutil.rmtree(tmp, ignore_errors=True)
        die("解包 app.asar 失敗: %s" % e)
    return tmp


def ensure_backup(asar_path, app_version, already):
    bak = asar_path + ".bak"
    if not already:
        if not os.path.exists(bak):
            shutil.copy2(asar_path, bak)
            say("[OK] 已備份官方原版 -> %s" % bak)
        elif os.path.getmtime(asar_path) > os.path.getmtime(bak):
            shutil.copy2(asar_path, bak)
            say("[OK] 檢測到官方版本已更新，已重新整理備份 -> %s" % bak)
        else:
            say("[*] 已有官方原版備份，直接使用")
        try:
            meta = save_persistent_backup(asar_path, app_version)
            say("[OK] 官方原版已另存：%s（版本 %s）" % (BACKUP_ASAR, app_version or "未知"))
            return meta
        except Exception as e:
            say("[!] 持久備份失敗（不影響安裝）: %s" % e)
    return read_meta()


def verify_new_asar(path, tmp_dir, patched_rels, expected_unpacked=None):
    """結構校驗：能讀頭、檔案數一致、unpacked 集合保持、關鍵注入檔案含標記、入口檔案存在。"""
    header_ok = False
    try:
        files = asar.list_files(path)
        header_ok = True
    except Exception as e:
        return False, "重建的 app.asar 無法讀取: %s" % e
    expected = 0
    for root, dirs, fs in os.walk(tmp_dir):
        expected += len(fs)
    if len(files) != expected:
        return False, "檔案數量不一致（期望 %d，實際 %d）" % (expected, len(files))
    names = set(rel for rel, size, unp in files)
    if expected_unpacked:
        got_unpacked = set(rel for rel, size, unp in files if unp)
        if got_unpacked != expected_unpacked:
            return False, "unpacked 檔案集合不一致（期望 %d，實際 %d）" % (
                len(expected_unpacked), len(got_unpacked))
    try:
        pkg = asar.read_json(path, "package.json")
    except Exception as e:
        return False, "讀取 package.json 失敗: %s" % e
    main_rel = str(pkg.get("main") or "").replace("\\", "/").lstrip("./")
    if main_rel and main_rel not in names:
        return False, "入口檔案不存在: %s" % main_rel
    for rel, marker in patched_rels:
        try:
            text = asar.read_file(path, rel).decode("utf-8", "ignore")
        except Exception as e:
            return False, "讀取 %s 失敗: %s" % (rel, e)
        if marker not in text:
            return False, "%s 缺少注入標記 %s" % (rel, marker)
    return True, "ok"


def has_installed_app(resources_dir):
    """判斷 asar 所在目錄是否是真實安裝目錄（旁邊有客戶端執行檔）。"""
    root = os.path.dirname(resources_dir)
    if sys.platform == "win32":
        return os.path.exists(os.path.join(root, "Antigravity.exe"))
    if sys.platform == "darwin":
        return os.path.isdir(root) and root.endswith(".app")
    return os.path.exists(os.path.join(root, "Antigravity"))


def cmd_install(args, launch_after=None):
    asar_path, resources_dir = detect_paths(args.asar)
    installed_app = has_installed_app(resources_dir)
    offline = bool(args.asar) and not installed_app
    exe = app_exe_path(resources_dir) if installed_app else None
    say("[*] 使用 app.asar: %s" % asar_path)
    say("[*] 客戶端: %s" % (exe or "未找到（稍後僅注入）"))

    dict_ = load_dictionary()
    dsha = dictionary_sha(dict_)
    say("[*] 詞典詞條: %d（%s）" % (len(dict_), dsha[:12]))

    if offline:
        say("[i] 離線模式（操作的是自訂 app.asar 副本，不啟動/不影響已安裝客戶端）")
    elif is_app_running():
        if not kill_app():
            die("Antigravity 正在執行且無法關閉，請手動完全退出後重試。")

    unpacked_set = original_unpacked_set(asar_path)
    if unpacked_set:
        say("[*] 原包 unpacked 檔案: %d 個（將原樣保持）" % len(unpacked_set))
    tmp = extract_and_prepare(asar_path)
    try:
        preload = os.path.join(tmp, "dist", "preload.js")
        if not os.path.exists(preload):
            die("解包結果裡沒有 dist/preload.js，客戶端結構可能已變化，已中止（未改動任何檔案）。")
        app_version = ""
        try:
            with open(os.path.join(tmp, "package.json"), "r", encoding="utf-8") as f:
                app_version = json.load(f).get("version", "")
        except Exception:
            app_version = ""
        say("[*] 客戶端版本: %s" % (app_version or "未知"))

        preload_text = read_text(preload)
        already = (("AG_ZH_BEGIN:engine" in preload_text)
                   or (ENGINE_START_MARKER in preload_text)
                   or ("Antigravity Chinese Translation Injection" in preload_text)
                   or ("Antigravity-ZH" in preload_text))
        ensure_backup(asar_path, app_version, already)
        if already:
            usable = [x for x in (asar_path + ".bak", BACKUP_ASAR)
                      if os.path.exists(x) and not quick_is_patched(x)]
            if not usable:
                say("[!] 警告：兩處官方備份都不可用（可能都被汙染/被刪）。")
                say("    這會導致將來無法一鍵還原英文原版。建議：在 Antigravity 裡執行「重新安裝/修復」，")
                say("    再執行本安裝器，即可重新生成當前版本的官方備份。")

        # ---- 注入（全部為「末尾追加 + try/catch」）----
        patched = []
        engine_block = build_engine_block(dict_)
        apply_blocks(preload, [("engine", engine_block)], engine=True)
        patched.append(("dist/preload.js", BLOCK_BEGIN % "engine"))
        say("[OK] dist/preload.js 注入翻譯引擎")

        wizard = os.path.join(tmp, "dist", "ideInstall", "wizardPreload.js")
        if os.path.exists(wizard):
            apply_blocks(wizard, [("engine", engine_block)], engine=True)
            patched.append(("dist/ideInstall/wizardPreload.js", BLOCK_BEGIN % "engine"))
            say("[OK] dist/ideInstall/wizardPreload.js 注入翻譯引擎")

        try:
            menu_js = os.path.join(tmp, "dist", "menu.js")
            if os.path.exists(menu_js):
                apply_blocks(menu_js, [("menu", build_menu_block())])
                patched.append(("dist/menu.js", BLOCK_BEGIN % "menu"))
                say("[OK] dist/menu.js 注入選單翻譯（執行時包裝）")
            else:
                say("[!] dist/menu.js 不存在，跳過選單翻譯")
            main_js = os.path.join(tmp, "dist", "main.js")
            if os.path.exists(main_js):
                apply_blocks(main_js, [("menu", build_menu_block()), ("dialog", build_dialog_block())])
                patched.append(("dist/main.js", BLOCK_BEGIN % "menu"))
                patched.append(("dist/main.js", BLOCK_BEGIN % "dialog"))
                say("[OK] dist/main.js 注入對話方塊/選單翻譯（執行時包裝）")
            else:
                say("[!] dist/main.js 不存在，跳過對話方塊翻譯")
        except Exception as e:
            say("[!] 主程序補丁跳過（不影響啟動）: %s" % e)

        patch_loading_overlay(tmp)

        # ---- 重新打包 + 結構校驗 ----
        build_dir = tempfile.mkdtemp(prefix="agy_zh_out_")
        new_asar = os.path.join(build_dir, "app.asar")
        say("[*] 重新打包（unpack: chrome-devtools-mcp）...")
        try:
            asar.pack(tmp, new_asar, UNPACK_PATTERNS, exact_unpack=unpacked_set)
        except Exception as e:
            die("重新打包失敗: %s（未改動任何檔案）" % e)
        if not os.path.exists(new_asar) or os.path.getsize(new_asar) == 0:
            die("打包結果為空（未改動任何檔案）")
        ok, reason = verify_new_asar(new_asar, tmp, patched, unpacked_set)
        if not ok:
            die("重建的 app.asar 結構校驗失敗：%s（未改動任何檔案）" % reason, 2)
        say("[OK] 結構校驗透過（檔案數 %d）" % len(asar.list_files(new_asar)))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # ---- 原子替換 ----
    swap_state = None
    try:
        swap_state = swap_in(asar_path, new_asar)
        say("[OK] 已替換 app.asar（新大小: %d bytes）" % os.path.getsize(asar_path))
        say("[OK] SHA256: %s" % sha256(asar_path))

        os.makedirs(USER_DIR, exist_ok=True)
        shutil.copy2(os.path.join(HERE, "dicts", "zh_tw.json"), EXT_DICT)
        say("[OK] 外部詞典已更新：%s" % EXT_DICT)

        # ---- 冒煙測試 ----
        do_smoke = (not args.no_smoke) and sys.platform == "win32" and not offline
        if do_smoke:
            ok, reason = smoke_test(exe)
            if not ok:
                say("")
                say("[X] 冒煙測試失敗：%s" % reason)
                say("[*] 正在自動回滾官方原版 ...")
                kill_app(15)
                if rollback_swap(asar_path, swap_state):
                    say("[OK] 已自動還原官方原版（未被中文化影響）")
                    if exe:
                        start_app(exe)
                        say("[i] 已重新啟動官方原版客戶端。")
                else:
                    say("[!] 自動回滾失敗！請執行「還原官方原版.bat」。")
                say("[i] 這說明當前客戶端版本與中文化補丁不相容。請把日誌發給我：")
                say("    " + (_LOG_PATH or "(無日誌)"))
                die("中文化未生效，已回滾，客戶端保持可用。", 3)
        else:
            if args.no_smoke:
                say("[!] 已跳過冒煙測試（--no-smoke）")
            else:
                say("[i] 非 Windows 平臺跳過冒煙測試")

        finalize_swap(swap_state)
        swap_state = None
        save_state(app_version, dsha, sha256(asar_path))
        if task_installed():
            try:
                write_autorepair_entry()
                say("[OK] 已重新整理開機自動修復項（指向當前安裝目錄）")
            except Exception as e:
                say("[!] 重新整理開機自動修復項失敗: %s" % e)
        say("")
        say("[DONE] 中文化完成，客戶端版本 %s。" % (app_version or "未知"))
    except SystemExit:
        raise
    except Exception as e:
        if swap_state:
            say("[!] 安裝過程出錯，正在回滾: %s" % e)
            rollback_swap(asar_path, swap_state)
        raise
    finally:
        try:
            shutil.rmtree(build_dir, ignore_errors=True)
        except Exception:
            pass

    if offline:
        launch_after = False
    if launch_after is None:
        launch_after = args.launch or args.auto
    if launch_after or do_smoke:
        if is_app_running():
            say("[i] 客戶端已在執行。")
        else:
            if start_app(exe):
                say("[OK] 已啟動 Antigravity。")
            else:
                say("[!] 未能自動啟動，請手動開啟 Antigravity。")
    say("[i] 日誌: %s" % (_LOG_PATH or "(無)"))
    return 0


# ---------------------------------------------------------------- 還原
def cmd_restore(args):
    asar_path, resources_dir = detect_paths(args.asar)
    exe = app_exe_path(resources_dir)
    cur_patched = quick_is_patched(asar_path)
    cur_version = safe_asar_version(asar_path)
    say("[*] 使用 app.asar: %s" % asar_path)
    say("[*] 當前客戶端版本: %s，中文化狀態: %s" % (cur_version or "未知", "已注入" if cur_patched else "官方原版"))

    if not cur_patched:
        say("[OK] 當前 app.asar 就是官方原版（未中文化），無需還原。")
        return 0

    candidates = []
    for label, path in (("安裝目錄備份", asar_path + ".bak"), ("使用者目錄備份", BACKUP_ASAR)):
        if not os.path.exists(path):
            continue
        if quick_is_patched(path):
            say("[!] %s 已被中文化汙染，忽略：%s" % (label, path))
            continue
        candidates.append((label, path, safe_asar_version(path)))
    if not candidates:
        say("[!] 找不到可用的官方原版備份。")
        say("    解決辦法（任選其一）：")
        say("      1. 重新雙擊「安裝中文化外掛.bat」——會為當前版本重新生成官方備份；")
        say("      2. 在 Antigravity 裡執行「重新安裝 / 修復」恢復官方檔案。")
        die("沒有可用備份，未做任何改動。", 4)

    matching = [c for c in candidates if c[2] and c[2] == cur_version]
    chosen = None
    if matching:
        chosen = matching[0]
    else:
        detail = "，".join("%s=%s" % (c[0], c[2] or "未知") for c in candidates)
        if args.force:
            chosen = candidates[0]
            say("[!] 備份版本與當前客戶端不一致（當前 %s，%s），因 --force 強制使用「%s」。"
                % (cur_version or "未知", detail, chosen[0]))
        else:
            say("[X] 備份版本與當前客戶端不一致：當前 %s，%s" % (cur_version or "未知", detail))
            say("    舊版本的 app.asar 還原到新客戶端會導致客戶端打不開。")
            say("    建議：先執行「安裝中文化外掛.bat」為當前版本生成官方備份，再執行還原。")
            die("版本不匹配，已拒絕還原（可用 --force 強制，但不推薦）。", 4)

    if not kill_app():
        die("Antigravity 正在執行且無法關閉，請手動退出後重試。")
    say("[*] 正在用「%s」還原 ..." % chosen[0])
    stage = asar_path + ".agzh_restore"
    shutil.copy2(chosen[1], stage)
    os.replace(stage, asar_path)
    try:
        if os.path.exists(STATE_FILE):
            os.remove(STATE_FILE)
    except Exception:
        pass
    say("[OK] 已還原官方原版（SHA256: %s）" % sha256(asar_path))
    say("[OK] 中文化已移除，請手動啟動 Antigravity。")
    return 0


# ---------------------------------------------------------------- 狀態
def cmd_status(args):
    asar_path, resources_dir = detect_paths(args.asar)
    exe = app_exe_path(resources_dir)
    say("安裝器版本: %s" % toolkit_version())
    say("客戶端: %s" % (exe or "未找到"))
    say("asar 路徑: %s" % asar_path)
    if not os.path.exists(asar_path):
        say("狀態: app.asar 不存在")
        return 0
    patched = quick_is_patched(asar_path)
    try:
        cur_version = safe_asar_version(asar_path)
    except Exception:
        cur_version = ""
    say("客戶端版本: %s" % (cur_version or "未知"))
    say("大小: %d bytes" % os.path.getsize(asar_path))
    say("SHA256: %s" % sha256(asar_path))
    say("中文化: %s" % ("已注入" if patched else "未注入（官方原版）"))
    say("執行中: %s" % ("是" if is_app_running() else "否"))

    state = load_state()
    if state:
        say("狀態檔案: 版本 %s，詞典 %s，注入於 %s" % (
            state.get("app_version", "?"), str(state.get("dict_sha256", ""))[:12],
            state.get("injected_at", "?")))

    bak = asar_path + ".bak"
    if os.path.exists(bak):
        say("備份(安裝目錄): 存在，版本 %s" % (safe_asar_version(bak) or "未知"))
    else:
        say("備份(安裝目錄): 無（客戶端更新通常會清掉）")
    if os.path.exists(BACKUP_ASAR):
        meta = read_meta()
        say("備份(使用者目錄): 存在，版本 %s，保存於 %s" % (
            meta.get("app_version") or safe_asar_version(BACKUP_ASAR) or "未知",
            meta.get("saved_at", "")))
    else:
        say("備份(使用者目錄): 無")
    try:
        n = len(load_dictionary())
        say("詞典: %d 條（%s）" % (n, dictionary_sha(load_dictionary())[:12]))
    except SystemExit:
        say("詞典: 讀取失敗")
    say("開機自動修復: %s" % ("已註冊" if task_installed() else "未註冊"))
    return 0


def _read_autorepair_value():
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_RUN_KEY, 0, winreg.KEY_READ) as k:
            val, _ = winreg.QueryValueEx(k, REG_VALUE_NAME)
            return val
    except Exception:
        return ""


def task_installed():
    if sys.platform != "win32":
        return False
    return bool(_read_autorepair_value())


def _python_for_startup():
    """優先用外掛包自帶的 pythonw.exe（無黑框），否則退回當前直譯器。"""
    cands = [os.path.join(HERE, "runtime", "pythonw.exe"),
             os.path.join(HERE, "runtime", "python.exe")]
    for c in cands:
        if os.path.exists(c):
            return c
    exe = sys.executable
    if exe.lower().endswith("python.exe"):
        w = os.path.join(os.path.dirname(exe), "pythonw.exe")
        if os.path.exists(w):
            return w
    return exe


def write_autorepair_entry():
    import winreg
    python = _python_for_startup()
    script = os.path.join(HERE, "install.py")
    command = '"%s" "%s" --auto-silent' % (python, script)
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_RUN_KEY, 0, winreg.KEY_SET_VALUE) as k:
        winreg.SetValueEx(k, REG_VALUE_NAME, 0, winreg.REG_SZ, command)
    # 清理舊方案（啟動資料夾 .bat / 計劃任務）殘留
    try:
        if os.path.exists(LEGACY_STARTUP_FILE):
            os.remove(LEGACY_STARTUP_FILE)
    except Exception:
        pass
    try:
        subprocess.run(["schtasks", "/Delete", "/TN", TASK_NAME, "/F"],
                       capture_output=True)
    except Exception:
        pass
    return command


def cmd_install_task(args):
    if sys.platform != "win32":
        die("僅 Windows 支援開機自動修復。")
    try:
        command = write_autorepair_entry()
    except Exception as e:
        die("註冊失敗: %s" % e)
    say("[OK] 已註冊登入時自動修復（HKCU 登錄檔 Run 項）：%s" % REG_VALUE_NAME)
    say("    命令: %s" % command)
    say("    之後每次登入系統會自動檢查；客戶端更新導致中文化消失時會自動重新安裝。")
    say("    注意：請不要移動或刪除本外掛目錄，否則自動修復會失效。")
    return 0


def cmd_remove_task(args):
    if sys.platform != "win32":
        die("僅 Windows 支援開機自動修復。")
    removed = False
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_RUN_KEY, 0, winreg.KEY_SET_VALUE) as k:
            winreg.DeleteValue(k, REG_VALUE_NAME)
            removed = True
    except FileNotFoundError:
        pass
    except OSError:
        pass
    try:
        if os.path.exists(LEGACY_STARTUP_FILE):
            os.remove(LEGACY_STARTUP_FILE)
            removed = True
    except Exception:
        pass
    try:
        r = subprocess.run(["schtasks", "/Delete", "/TN", TASK_NAME, "/F"], capture_output=True)
        if r.returncode == 0:
            removed = True
    except Exception:
        pass
    if removed:
        say("[OK] 已取消登入時自動修復。")
    else:
        say("[!] 之前沒有註冊自動修復，無需取消。")
    return 0


# ---------------------------------------------------------------- 智慧模式
def cmd_auto(args, silent=False):
    asar_path, resources_dir = detect_paths(args.asar)
    exe = app_exe_path(resources_dir)
    if is_app_running():
        if silent:
            say("[i] 客戶端正在執行，自動修復跳過。")
            return 0
        say("[i] 客戶端已在執行。")
        if exe:
            start_app(exe)
        return 0
    if not os.path.exists(asar_path):
        die("找不到 app.asar，請先安裝 Antigravity。")

    dict_ = load_dictionary()
    dsha = dictionary_sha(dict_)
    state = load_state()
    if quick_is_patched(asar_path):
        ver = safe_asar_version(asar_path)
        if state.get("dict_sha256") == dsha and state.get("app_version") == ver:
            say("[OK] 當前已是最新中文化（客戶端 %s），直接啟動。" % (ver or "未知"))
            if not silent:
                start_app(exe)
            return 0
        say("[*] 中文化版本或詞典有更新，重新注入 ...")
    else:
        say("[*] 檢測到客戶端未中文化（可能是剛自動更新過），開始注入 ...")

    if silent:
        args.no_smoke = True
        args.launch = False
        return cmd_install(args, launch_after=False)
    args.launch = True
    return cmd_install(args, launch_after=True)


def cmd_create_shortcut(args):
    if sys.platform != "win32":
        die("僅 Windows 支援建立桌面捷徑。")
    launcher = None
    for name in ("中文化並啟動.bat", "launch-windows.bat"):
        cand = os.path.join(HERE, name)
        if os.path.exists(cand):
            launcher = cand
            break
    if not launcher:
        die("找不到「中文化並啟動.bat」，請確認外掛包檔案完整。")
    ps = (
        "$ErrorActionPreference = 'Stop'\n"
        "$desktop = [Environment]::GetFolderPath('Desktop')\n"
        "$path = Join-Path $desktop 'Antigravity 中文化版.lnk'\n"
        "$ws = New-Object -ComObject WScript.Shell\n"
        "$lnk = $ws.CreateShortcut($path)\n"
        "$lnk.TargetPath = '%TARGET%'\n"
        "$lnk.WorkingDirectory = '%WORKDIR%'\n"
        "$lnk.Description = 'Antigravity 中文化版（自動重新中文化後啟動）'\n"
        "$lnk.IconLocation = '%ICON%'\n"
        "$lnk.Save()\n"
        "Write-Output $path\n"
    )
    target = launcher
    workdir = HERE
    icon = app_exe_path() or ""
    content = ps.replace("%TARGET%", target.replace("'", "''")) \
                .replace("%WORKDIR%", workdir.replace("'", "''")) \
                .replace("%ICON%", (icon.replace("'", "''") + ",0") if icon else "")
    ps1 = os.path.join(tempfile.gettempdir(), "agy_zh_shortcut.ps1")
    with open(ps1, "w", encoding="utf-8-sig") as f:
        f.write(content)
    try:
        r = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                            "-File", ps1],
                           capture_output=True, text=True, encoding="utf-8", errors="ignore")
        if r.returncode != 0:
            die("建立捷徑失敗：%s %s" % ((r.stdout or "").strip(), (r.stderr or "").strip()))
        say("[OK] 已建立桌面捷徑：Antigravity 中文化版")
        say("    指向：%s" % launcher)
        say("    以後從桌面這個捷徑啟動，客戶端更新後會自動重新中文化。")
    finally:
        try:
            os.remove(ps1)
        except Exception:
            pass
    return 0


def main():
    setup_log()
    ap = argparse.ArgumentParser(description="Antigravity 中文化安裝器 v%s（零依賴）" % toolkit_version())
    ap.add_argument("--restore", action="store_true", help="還原官方原版（會校驗版本）")
    ap.add_argument("--status", action="store_true", help="檢視中文化狀態")
    ap.add_argument("--auto", action="store_true", help="智慧模式：需要時重新中文化，然後啟動")
    ap.add_argument("--auto-silent", action="store_true", help="智慧模式：需要時重新中文化，不啟動（開機任務用）")
    ap.add_argument("--launch", action="store_true", help="完成安裝後啟動客戶端")
    ap.add_argument("--no-smoke", action="store_true", help="跳過安裝後的啟動冒煙測試（不推薦）")
    ap.add_argument("--force", action="store_true", help="還原時允許使用版本不匹配的備份（不推薦）")
    ap.add_argument("--install-task", action="store_true", help="註冊登入時自動修復（HKCU 登錄檔 Run 項）")
    ap.add_argument("--remove-task", action="store_true", help="取消登入時自動修復")
    ap.add_argument("--create-shortcut", action="store_true", help="建立「Antigravity 中文化版」桌面捷徑")
    ap.add_argument("--asar", default=None, help="手動指定 app.asar 路徑")
    ap.add_argument("--version", action="store_true", help="顯示版本")
    args = ap.parse_args()

    if args.version:
        say("Antigravity 中文化安裝器 v%s" % toolkit_version())
        return
    if args.status:
        sys.exit(cmd_status(args))
    if args.restore:
        sys.exit(cmd_restore(args))
    if args.install_task:
        sys.exit(cmd_install_task(args))
    if args.remove_task:
        sys.exit(cmd_remove_task(args))
    if args.create_shortcut:
        sys.exit(cmd_create_shortcut(args))
    if args.auto_silent:
        sys.exit(cmd_auto(args, silent=True))
    if args.auto:
        sys.exit(cmd_auto(args, silent=False))
    sys.exit(cmd_install(args))


if __name__ == "__main__":
    main()
