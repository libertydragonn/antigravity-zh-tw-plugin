# 專案復現提示詞（Prompt）

把下面整段內容交給任意一個具備檔案讀寫、命令列執行能力的 AI 程式設計代理程式，它就能從零復現這個專案。
建議按「階段」讓它分批交付，每階段單獨驗證。本版本對應外掛 **v1.5.0**，重點是把「裝完客戶端打不開」從架構上消滅。

---

## 精簡版（一句話啟動）

> 幫我做一個 Google Antigravity 桌面客戶端的中文化外掛：不要改業務程式碼，用純 Python 解包 `app.asar`，
> 只往 `dist/preload.js` 等入口**末尾追加**帶標記、整體 `try/catch` 的翻譯補丁（渲染程序 DOM 引擎 +
> 主程序選單 / 系統匣 / 彈窗執行時包裝）；安裝後**真啟動一次客戶端做冒煙測試**，失敗自動回滾官方原版；
> 再打成「解壓雙擊即裝」的外掛包，客戶端自動更新後雙擊一次或登入時自動修復；還原時必須校驗客戶端版本。

---

## 完整版（可直接複製）

### 0. 角色與目標

你是一名熟悉 Electron 打包格式（asar）、DOM 注入、Windows 批處理與桌面端分發的工程師。

目標：為 **Google Antigravity 桌面客戶端（Electron，Agent Manager）** 做一套中文化方案，滿足六條硬性要求：

1. **不改業務程式碼**——只往 Electron 的關鍵入口追加唯讀的翻譯執行時，不攔截網路、不改狀態。
2. **零依賴安裝**——安裝器只用 Python 標準庫，不需要 Node / npm / asar CLI。
3. **使用者只做三步**——下載 zip、解壓、雙擊。客戶端自動更新後同樣只需雙擊一次即可恢復中文化。
4. **隨時可還原**——即使客戶端更新把安裝目錄裡的備份清空，也必須有第二條還原路徑；且還原前必須校驗版本。
5. **絕不能把客戶端裝壞**——只追加 + `try/catch` 失敗隔離 + 安裝後冒煙測試 + 失敗自動回滾。
6. **更新後自愈**——提供智慧模式（需要才重新注入）、登入自動修復（HKCU 登錄檔 Run 項）和桌面捷徑。

### 1. 環境與路徑

客戶端安裝位置（自動探測，按順序）：

- Windows：`%LOCALAPPDATA%\Programs\Antigravity\resources\app.asar`，其次 `%ProgramFiles%\Antigravity\resources\app.asar`
- macOS：`/Applications/Antigravity.app/Contents/Resources/app.asar`
- Linux：`/opt/Antigravity/resources/app.asar`、`~/.local/share/Antigravity/resources/app.asar`

基線版本：Antigravity **2.32.1**。`app.asar` 內需要關注的入口：

| 檔案 | 執行環境 | 職責 |
| --- | --- | --- |
| `dist/preload.js` | 渲染程序 | 主介面全部 DOM 文本 |
| `dist/ideInstall/wizardPreload.js` | 渲染程序 | 首次啟動向導 |
| `dist/menu.js` | 主程序 | 原生選單欄、系統匣選單 |
| `dist/tray.js` | 主程序 | 系統匣選單（v1.5.0 不直接改，由選單包裝覆蓋） |
| `dist/main.js` | 主程序 | 原生對話方塊（退出確認、檔案選擇、錯誤框） |
| `dist/loadingOverlay.js` | 主程序 | 啟動載入畫面 |

### 2. 階段一：純 Python 實現 asar 讀寫（`asar.py`）

asar 結構：

```text
[4 位元組 uint32 = 4（size pickle 的 payload 長度）]
[4 位元組 uint32 = header pickle 總長 = 8 + align4(json_size)]
[4 位元組 uint32 = 4 + align4(json_size)]
[4 位元組 int32  = json_size]
[json_size 位元組 JSON 結構表，補齊到 4 位元組對齊]
[檔案內容按結構表裡的 offset 拼接]
```

要求：

- `extract(path, dest)`：還原完整目錄樹，並把 `*.unpacked` 目錄內容合併回對應位置。
- `pack(src_dir, out_path, unpack_glob)`：重新生成 asar，命中的 glob（本專案的
  `**/node_modules/chrome-devtools-mcp/**`）保持為 `app.asar.unpacked`，**不能塞進 asar**。
- 為每個檔案寫 `integrity`（整檔案 SHA256 + 每 4 MB 分塊 SHA256），與官方 `@electron/asar` 一致。
- 校驗頭部：首欄位是 pickle payload 長度（恆為 4）而非版本號，要做合理性檢查。
- 額外提供 `list_files()` / `read_file()` / `read_json()` / `file_count()`，供安裝器做**替換前結構校驗**與版本讀取。
- 目標是與官方 `@electron/asar` 產物交叉驗證一致（檔案數、解包後內容一致即可）。

### 3. 階段二：安裝器（`install.py`）主流程

流程：

```text
探測路徑 → 讀詞典/算雜湊 → 客戶端在執行就關閉
→ 解包到臨時目錄 → 檢查 dist/preload.js 存在 → 讀版本 / 判斷是否已注入
→ 備份官方原版（兩處）→ 只追加補丁塊 → 重新打包 → 替換前結構校驗
→ 同目錄暫存 + os.replace 原子替換（保留替換前副本）
→ 複製外部詞典 → 冒煙測試（Windows 預設）
→ 成功：刪除保留副本、寫 state.json、啟動客戶端
→ 失敗：回滾替換前副本、啟動官方版、退出碼 3
```

關鍵設計（照做）：

- **標記塊 + 只追加**：每個補丁塊寫成
  `// ===== AG_ZH_BEGIN:<name> =====` … `// ===== AG_ZH_END:<name> =====`，整體包在 `try/catch` 裡，
  只在檔案末尾追加，**不對 `menu.js` / `tray.js` / `main.js` 做就地字串替換**。
- **失敗隔離**：補丁初始化異常只 `console.error`，絕不向上拋；`menu.js` / `main.js` 注入失敗只打印跳過，不終止安裝。
- **重新安裝清理**：`apply_blocks()` 先按標記清理舊塊（新格式的 `AG_ZH_BEGIN:` 字首、歷史 TAG 註釋、舊選單塊起點、
  舊引擎起點 `const dictionary = {`），再從錨點截斷到檔案尾、重新追加，保證引擎 / 選單塊永遠只有最新一份。
- **冒煙測試**：替換後清空 `ELECTRON_RUN_AS_NODE` 等變數啟動客戶端；先記錄
  `%APPDATA%\Antigravity\logs\main.log` 的位元組偏移，60 秒內輪詢「新增日誌出現 `Starting app (v`」且程序穩定存活；
  失敗 → 殺程序 → 用替換前保留的 `app.asar` + `app.asar.unpacked` 回滾 → 啟動官方原版 → 退出碼 3。
- **原子替換可回退**：先把當前 `app.asar` 複製為 `app.asar.agzh_keep.asar`、unpacked 改名為 `.agzh_old`，
  新 asar 寫同目錄暫存檔案後 `os.replace`；成功才刪除保留副本。
- **替換前結構校驗**：`verify_new_asar()` 檢查頭部可讀、檔案數與源目錄一致、`package.json` 的 `main` 入口存在、
  每個被注入檔案確實含對應 BEGIN 標記；失敗退出碼 2，且**未改動客戶端檔案**。
- **程序佔用檢查**：Windows 用 `tasklist /FI "IMAGENAME eq Antigravity.exe"`，macOS 只匹配
  `Antigravity.app/Contents/MacOS` 路徑，避免誤報；關不掉時以退出碼 1 結束。
- **客戶端版本**：從解包出的 `package.json` 讀 `version`，寫進備份後設資料與 `state.json`。
- **外部詞典**：安裝成功後把 `dicts/zh_tw.json` 複製到 `%USERPROFILE%\.antigravity-zh\zh-TW.json` 供熱重載。

退出碼約定（重要，驗收會看）：

| 退出碼 | 含義 |
| --- | --- |
| `0` | 成功；還原時表示無需還原 |
| `1` | 前置條件 / 參數錯誤（找不到 asar、客戶端無法關閉、解包失敗等） |
| `2` | 注入或結構校驗失敗，安裝中止（未改動客戶端檔案） |
| `3` | 冒煙測試失敗，已自動回滾 |
| `4` | 還原被拒（沒有可用備份，或備份版本與當前客戶端不一致） |

### 4. 階段三：翻譯引擎（`dicts/engine.js`）—— 本專案最核心的部分

引擎是注入到 `preload.js` 的 IIFE，暴露 `window.__AG_ZH__`（含 `translate` / `version` / `dictSize` / `pending`）。

#### 4.1 詞典索引

安裝時把 `dicts/zh_tw.json` 內嵌進引擎（`__DICT_ITEMS__` 佔位符替換），啟動後再讀取
`%USERPROFILE%\.antigravity-zh\zh-TW.json` 覆蓋。建構四份結構：

```text
exactLookup      : 原文 → 譯文（區分大小寫，O(1)）
lowerLookup      : 小寫 → 譯文（忽略大小寫，先到先得）
tokenLookup      : 單個單詞 → 譯文（僅供短句逐詞兜底）
translationCache : 600 字元以內結果快取（上限 8000 條）
```

為什麼必須區分大小寫優先：React 常把 `2 projects` 拆成 `2` + ` projects`。
`Projects`（側邊欄標題）= 專案，`projects`（計數單位）= 個專案，兩條必須共存。

#### 4.2 十二級流水線（順序不可調換，命中即返回）

1. 純標點節點 → 轉全形（快捷鍵上下文除外）
2. 不含英文字母 → 原樣返回（保證冪等）
3. 純快捷鍵組合（修飾鍵 + 單鍵）→ 原樣返回
4. 結果快取（≤600 字元，LRU 8000 條）
5. 動態日誌塊：`Worked for 1h2m` / `Edited x +3 -1` / `N files changed` / `Explored N files`
6. **精確匹配** `exactLookup`
7. **忽略大小寫** `lowerLookup`
8. 去掉尾部標點再匹配，命中後按原標點補全形
9. 時長短語預處理：`6 days, 23 hours` → `6 天 23 小時`
10. **動態正則規則**（整串錨定，約 200 條）
11. 安全護欄：>3 個單詞未命中 / 已含中文 → 保持英文
12. 短文本逐詞兜底：僅當每個 ≥2 字母的單詞都在詞典中，才整句逐詞替換

設計意圖：先詞典後規則 → 已校對文案不被正則劫持；先精確後忽略大小寫 → 同詞不同義共存；
第 11 級保證「寧可不翻也不輸出中英夾雜」（絕不能出現「已失敗 to 執行」）。

#### 4.3 拆分句合併

React 會把一句話拆成多個文本節點，逐節點翻譯會得到「否 自動化 yet」這種殘句。規則：

- 父節點沒有元素子節點、且文本節點 ≥ 2；
- 父節點 `textContent` 按空白歸一後，若整句命中詞典；
- 把譯文寫入第一個文本節點，其餘置空（保留節點結構，不影響 React 協調）。

#### 4.4 動態塊與規則

- `fmtDuration`：`1d2h3m4.5s` → `1 天 2 小時 3 分 4.5 秒`（相鄰單位補空格）。
- `dynamicRules` 是 `[正則, 譯文模板或回呼]` 陣列，**必須整串錨定**（`^...$`），例如
  `[/^Turn (\d+) of (\d+)$/i, "第 $1 輪（共 $2 輪）"]`。
- `translateCaptured(name)`：對正則捕獲到的名稱二次查詞，避免「「New Conversation」的快捷鍵」這類半句英文。

#### 4.5 DOM 層

- `MutationObserver` 監聽 `childList` / `characterData` / `attributes`，
  屬性白名單：`placeholder`、`title`、`aria-label`、`value`。
- 兩個佇列：新增節點 / 屬性變化進**優先佇列**，首次全量掃描進**普通佇列**。
- `requestIdleCallback` 每片處理 2–10ms；背景化被節流時用 `setTimeout(250ms)` 兜底。
- 遞迴遍歷 `shadowRoot`。
- 冪等：譯文不含英文字母，`characterData` 回呼判斷不成立，天然不會二次入隊。

#### 4.6 不翻譯什麼

| 跳過 | 原因 |
| --- | --- |
| `SCRIPT/STYLE/CODE/PRE/KBD/SAMP/VAR` | 程式碼、快捷鍵保持原樣 |
| `[data-testid="thinking-collapsible"]`、`planner-response-text`、`artifact-view` | 模型自由文本，逐詞機翻會亂碼 |
| 類名含 `monaco`/`hljs`/`shiki`/`code-line`/`diff` | 程式碼與預覽區 |
| 長句未整句命中 | 寧保留英文 |
| 第三方外掛 / 技能營銷長文 | 硬翻品質差 |

例外：思考鏈容器裡的「已思考 X 秒」「已工作 X 分」觸發藥丸是系統 UI，需放行（`TRIGGER_SELECTOR`）。

### 5. 階段四：原生層中文化——v1.5.0 的執行時包裝

> 重要：**不要**再就地替換 `menu.js` / `tray.js` / `main.js` 裡的字串。官方一改結構，替換就失效，
> 更糟的是可能改壞主程序程式碼導致客戶端打不開。v1.5.0 改為「末尾追加執行時包裝」。

- **`menu.js`**：追加一個 IIFE，`require("electron")` 拿到 `Menu`，包裝 `Menu.setApplicationMenu` 與
  `Menu.buildFromTemplate`，遞迴翻譯選單項的 `label`；沒有 `label` 時按 `role` 補中文。
  維護 `MENU_LABELS` 與 `MENU_ROLES` 兩張表，動態文案用正則（`N active agents`、`Open X`）兜底。
- **系統匣（`tray.js`）**：系統匣選單由 `Menu.buildFromTemplate(actions)` 建構，已被上面的包裝覆蓋，
  **不需要也不應該**單獨改 `tray.js`；系統匣標籤進 `MENU_LABELS` 即可。
- **`main.js`**：追加兩個塊——`menu`（同樣的選單包裝，兜底主程序其他位置的選單）和
  `dialog`（包裝 `showMessageBox` / `showMessageBoxSync` / `showOpenDialog(Sync)` /
  `showSaveDialog(Sync)` / `showErrorBox`，翻譯 `title` / `message` / `detail` / `buttons` 等欄位）。
  相容 `(options)` 與 `(browserWindow, options)` 兩種呼叫簽名。
- **`loadingOverlay.js`**（唯一例外）：它是 HTML 模板字串裡的一行文案，只能在模板裡替換 / 插入。
  優先替換 `<div class="text">Loading Antigravity</div>`；新版只有 Logo 時在 `</svg>` 後插入中文行 +
  `<!-- AG_ZH_LOADING -->` 標記。插入文本**禁止包含** `$`、`` ` ``、`\`，錨點缺失就跳過。

所有包裝器都要：整體 `try/catch`、用 `Menu.__AG_ZH_MENU__` / `dialog.__AG_ZH_DIALOG__` 標記防重複包裝。

### 6. 階段五：詞典（`dicts/zh_tw.json`）

- 結構就是最簡單的 `{"英文原文": "中文譯文"}`，v1.5.0 目標 6500+ 條。
- 含變數的文案**不寫進詞典**，改用 `dynamicRules`。
- 同詞不同義用大小寫區分（`Projects` / `projects`）。
- 合併社群詞典時必須過濾：URL、佔位符與原文不匹配、超長條目、空 key、隱私資訊（郵箱 / 使用者名稱 / 本機路徑）。
- 統一術語：工件 Artifact、工作樹 Worktree、沙箱 Sandbox、審查 Review、分叉 Fork、
  代理程式 Agent、子代理程式 Subagent、配額 quota、額度 credits、自訂 Customizations。

### 7. 階段六：備份、還原與版本校驗（雙保險，務必實現）

| 位置 | 作用 |
| --- | --- |
| `<resources>/app.asar.bak` | 就地還原 |
| `%USERPROFILE%\.antigravity-zh\backup\app.asar.orig` + `meta.json` | 持久備份（客戶端版本、大小、SHA256、時間） |

- 安裝時若當前 asar 是官方原版，兩處都寫；若已是中文化版則不覆蓋官方備份。
- 候選備份要先校驗未被注入（asar 不壓縮，直接位元組搜尋 TAG / `AG_ZH_BEGIN:` 即可），避免把補叮噹原版還原回去。
- **還原前必須做版本校驗**：讀取當前 asar 與每個備份 asar 內 `package.json` 的 `version`，
  只接受與當前客戶端版本一致的備份；不一致時拒絕並提示先重新安裝 / 修復或以 `--force` 強制（退出碼 4）。
  舊版 asar 裝到新客戶端上會打不開——這是「還原把應用弄壞」的根因。
- 當前已是官方原版時：輸出「無需還原」並退出碼 0，而不是報錯。
- 還原流程：關閉客戶端 → 同目錄暫存 + `os.replace` 原子替換 → 刪除 `state.json` → 不修改 `.unpacked`。

### 8. 階段七：快速重新中文化（更新後自愈）

`%USERPROFILE%\.antigravity-zh\state.json`：

```json
{
  "app_version": "2.32.1",
  "dict_sha256": "…",
  "injected_sha256": "…",
  "injected_at": "2026-11-14 10:30:00",
  "toolkit_version": "1.5.0"
}
```

- `--auto`：客戶端在執行 → 直接聚焦 / 啟動；否則若「已注入 + `dict_sha256` 一致 + `app_version` 一致」→
  直接啟動（<1 秒），否則重新注入後啟動。
- `--auto-silent`：同樣判斷，但只注入不啟動（內部跳過冒煙測試），供登入自動修復使用。
- `--install-task` / `--remove-task`：寫 / 刪 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 下的
  `REG_SZ` 值 `AntigravityZhAutoRepair`，資料為
  `"<外掛目錄>\runtime\pythonw.exe" "<外掛目錄>\install.py" --auto-silent`
  （優先 pythonw，無黑框；沒有內建執行環境則退回當前直譯器）。
  不寫「啟動」資料夾、不建計劃任務（前者會被安全軟體攔截），不需要管理員權限；
  `--remove-task` 同時清理舊方案殘留（啟動資料夾裡的 `.bat`、舊的同名計劃任務）。
  安裝成功後若檢測到已註冊，會自動重新整理資料為當前外掛目錄；值裡記錄外掛目錄絕對路徑，移動目錄後需重新註冊。
- `--create-shortcut`：在桌面建立「Antigravity 中文化版」捷徑，目標指向 `中文化並啟動.bat`，圖示取客戶端 exe。
- `--launch`：注入完成後啟動客戶端；`--no-smoke`：跳過冒煙測試（不推薦）。

### 9. 階段八：外掛包（`build_release.py`）

產物：`dist/Antigravity-zh-plugin-v1.5.0.zip`（約 11 MB）+ `.sha256`。

```text
Antigravity中文化外掛-v1.5.0/
├── 安裝中文化外掛.bat          ← 雙擊這個（完整安裝 + 冒煙 + 啟動）
├── 還原官方原版.bat          → install.py --restore
├── 中文化並啟動.bat            → install.py --auto
├── 建立桌面捷徑.bat       → 建立「Antigravity 中文化版」捷徑，指向 中文化並啟動.bat
├── 註冊開機自動修復.bat       → install.py --install-task
├── 取消開機自動修復.bat       → install.py --remove-task
├── 使用說明.txt
├── install.py / asar.py
├── dicts/  docs/  README.md  LICENSE  VERSION
├── install-macos.sh / launch-macos.sh / restore-macos.sh
└── runtime/                  ← Windows 版 Python embeddable（使用者機器無需裝 Python）
```

要求：

- `.bat` 全部轉 CRLF，`.sh` 轉 LF，`.sh` 置 755。
- 包內檔名可以中文，但 **GitHub Release 的資產名只能是 ASCII**（中文會被替換成 `.`），
  所以 zip 用 `Antigravity-zh-plugin-<ver>.zip`，包內資料夾保留中文名。
- 啟動指令碼優先用包內 `runtime\python.exe`，找不到再回退 `python` / `py -3`。
- 建構時校驗詞典 JSON、輸出檔案數與 SHA256。
- 發布前把文件裡的詞典條數佔位符替換成真實數字。

### 10. 階段九：文件與發布

- `README.md`：快速開始必須是「下載 → 解壓 → 雙擊」三步，不要以命令列開篇；
  必須有「更新後怎麼辦」「命令與參數」「工作原理」「故障排查」「FAQ」「術語表」「更新日誌」。
- `docs/HOW_IT_WORKS.md`：注入點、只追加與失敗隔離、冒煙測試與回滾、`state.json` 快速判定、
  流水線、DOM 排程、熱重載、除錯、加詞條實操、已知限制。
- `SKILL.md`：供 AI 代理程式呼叫的技能說明，含參數列、退出碼、驗收流程。
- 發布到 GitHub：public 存放庫 + Release 附 zip 與 `.sha256`，說明裡寫清安裝 / 還原 / 更新後恢復步驟。

### 11. 必須提前知道的坑（照做，別重犯）

1. `.bat` **必須 CRLF**，否則 cmd 會把多行連成一條命令，出現 `'ERR]' 不是內部或外部命令`。
2. `timeout /t N` 在 stdin 被重定向時直接報錯，改用 `ping -n N 127.0.0.1 >nul`。
3. `start "" "app.exe"` 要加 `>nul 2>&1`，否則會佔住呼叫方管道導致卡住。
4. 批處理裡 `chcp 65001` 之外，還要給 Python 設 `PYTHONUTF8=1`、`PYTHONIOENCODING=utf-8`，否則重定向日誌是亂碼。
5. 客戶端自動更新會整體替換 `resources/`，`.bak` 會消失 → 必須做使用者目錄持久備份。
6. GitHub Release 資產名不支援中文 → 用 ASCII 檔名。
7. 注入後 asar 體積會從約 5.7 MB 漲到約 6.9 MB（詞典內嵌），這是正常的。
8. 舊引擎塊不清乾淨會導致「新詞典永不生效」——必須從錨點到檔案尾整體重建。
9. 不要用 PyInstaller 賭 Python 版本相容性，內建 official embeddable runtime 更穩。
10. 使用者機器上的 git 代理可能失效（例如指向已關閉的埠），`git clone` 報
    `Failed to connect to github.com:443 over proxy ...` 時，先清掉全域性代理配置或改成實際在監聽的埠。
11. **不要就地替換 `menu.js` / `tray.js` / `main.js` 的原始碼字串**：官方結構一變，輕則翻譯失效，
    重則主程序語法錯誤 → 客戶端打不開。只追加帶標記、整體 `try/catch` 的執行時包裝。
12. **冒煙測試要清環境變數**：`ELECTRON_RUN_AS_NODE`、`NODE_USE_ENV_PROXY`、`ELECTRON_NO_ATTACH_CONSOLE`，
    否則客戶端會被當 Node 啟動。
13. **冒煙測試要按位元組偏移讀日誌**：先記錄 `main.log` 大小，只認新增內容裡的 `Starting app (v`，
    否則歷史日誌會讓舊記錄誤判成功；看到啟動日誌後還要再觀察幾秒確認程序穩定存活。
14. **回滾必須用替換前保留的副本**，並且同時恢復 `app.asar` 與 `app.asar.unpacked`；
    不要依賴使用者目錄備份（可能沒有或版本不匹配）。
15. **結構校驗必須在替換前做**：檔案數、`package.json` 的 `main` 入口、每個注入檔案的 BEGIN 標記；
    校驗失敗時客戶端檔案必須原封不動（退出碼 2）。
16. **還原必須版本匹配**：舊 asar 裝到新客戶端會打不開；沒有匹配備份時拒絕並以退出碼 4 結束，`--force` 才放行。
17. `loadingOverlay.js` 的插入文本不能含 `$`、`` ` ``、`\`，否則模板字串會插值 / 轉義出錯。
18. 開機自動修復**不要**寫「啟動」資料夾裡的 `.bat`（會被安全軟體攔截，實測 Permission denied），也**不要**建計劃任務；
    寫 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 的 `REG_SZ` 值最穩，無需管理員權限。
    資料必須寫成 `"<pythonw>" "<install.py>" --auto-silent`（兩個路徑都加引號），優先 `runtime\pythonw.exe` 避免黑框。
19. `--auto` 快速路徑要同時比對**詞典雜湊**和**客戶端版本**，只比其中一個會在更新後誤判「已是最新」。
20. 判斷 asar 是否已注入：asar 不壓縮，直接按位元組搜尋 TAG / 標記即可，不需要解包，速度快。

### 12. 驗收標準（逐條自測）

**v1.5.0 安全驗收（必做）**：

- [ ] 2.32.1 官方原版 → 雙擊 `安裝中文化外掛.bat` → 客戶端自動開啟、介面中文、命令列無報錯、退出碼 0。
- [ ] 模擬客戶端更新（用官方 `app.asar` 覆蓋已中文化檔案）→ 雙擊 `中文化並啟動.bat` → 自動重新注入並開啟中文介面。
- [ ] **破壞性測試**：注入一個必定讓主程序崩潰的補丁 → 冒煙測試捕獲 → 自動回滾為官方原版 → 客戶端能正常開啟，退出碼 3。
- [ ] `--restore` 且備份版本匹配 → 還原成功；備份版本不匹配 → 拒絕並提示，退出碼 4。
- [ ] 外掛 zip 解壓 → 雙擊 `安裝中文化外掛.bat` → 成功，退出碼 0。
- [ ] 詞典無隱私資訊（郵箱 / 使用者名稱 / 本機路徑）。
- [ ] `--auto` 在已中文化且詞典 / 版本未變時 1 秒內直接開啟客戶端。
- [ ] `--install-task` 後登錄檔 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 下存在 `AntigravityZhAutoRepair`（`--status` 顯示已註冊）；`--remove-task` 能刪除。

**中文化品質驗收**：

- [ ] `--status` 輸出「中文化: 已注入」，兩處備份都存在且版本與客戶端一致，狀態檔案有記錄。
- [ ] 主介面、設定（各標籤頁）、專案設定、命令面板、外掛市場、自動化頁、載入畫面、原生選單、系統匣選單均無英文殘留。
- [ ] `Ctrl+Shift+P`、`/goal`、模型名（如 `Claude Sonnet 4.6 (Thinking)`）保持原樣。
- [ ] 模型回覆正文、程式碼塊、diff 保持英文。
- [ ] `2 projects` → `2 個專案`，側邊欄 `Projects` → `專案`（兩條件共存）。
- [ ] 刪除 `resources\app.asar.bak` 後，還原仍成功（走使用者目錄備份）。
- [ ] 當前已是官方原版時執行還原，提示「無需還原」且退出碼 0。

### 13. 輸出要求

- 按階段交付，每階段給出可獨立執行的驗證方法（命令 + 期望輸出）。
- 程式碼保持純標準庫、單檔案可讀、註釋用中文，路徑與常量集中在檔案頭部。
- 詞典與規則分離：固定文案進 JSON，含變數的進 `dynamicRules`。
- 所有補丁遵守「只追加 + `try/catch` + BEGIN/END 標記」三原則，並在文件中寫清回滾路徑。
- 最後附一段「已知限制」：模型正文保持英文、新版本新增文案可能漏翻、動態規則改動需重新安裝、
  macOS / Linux 暫無冒煙測試、修改 `app.asar` 可能違反服務條款。

