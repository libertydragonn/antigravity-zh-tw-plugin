# 翻譯機制詳解（HOW IT WORKS）

本文說明 `antigravity-zh` 到底往客戶端裡放了什麼、翻譯是怎麼一步步發生的、v1.5.0 如何做到「裝不壞」、以及怎樣安全地加詞條和排查問題。

- 只想用外掛：看 [README](../README.md) 就夠了
- 想改程式碼 / 加詞條 / 排查問題：看這裡

---

## 1. 總覽：三個部分

```text
┌───────────────────────────────────────────────────────────────┐
│ install.py   安裝器：探測路徑 → 關閉客戶端 → 解包 asar        │
│              → 追加補丁 → 結構校驗 → 原子替換 → 冒煙測試      │
│              → 成功收尾 / 失敗回滾；另負責備份、還原、開機自動修復 │
├───────────────────────────────────────────────────────────────┤
│ dicts/engine.js   翻譯引擎模板：DOM 監聽 + 12 級流水線 + 動態規則│
├───────────────────────────────────────────────────────────────┤
│ dicts/zh_tw.json  整句詞典："英文原文": "中文譯文"             │
└───────────────────────────────────────────────────────────────┘
```

v1.5.0 的第一目標是**絕不把客戶端裝壞**。所有設計都圍繞這一點：

1. 只**追加**補丁，不改官方原有程式碼；
2. 每個補丁塊整體 `try/catch`，補丁自身出錯不影響客戶端啟動；
3. 安裝後真啟動一次做冒煙測試，失敗自動回滾；
4. 還原前校驗客戶端版本，避免舊 asar 裝到新客戶端上。

---

## 2. 注入架構：只追加 + 失敗隔離

### 2.1 標記塊

每個補丁塊都帶一對標記，便於識別、清理和重建：

```js
// ===== AG_ZH_BEGIN:engine =====
try {
  (function () {
    // ... 補丁程式碼 ...
  })();
} catch (e) {
  try { console.error("[Antigravity-ZH] 補丁初始化失敗", e); } catch (_) {}
}
// ===== AG_ZH_END:engine =====
```

規則：

- **只在檔案末尾追加**，不對 `menu.js` / `tray.js` / `main.js` 做就地字串替換；
- 每個塊整體包在 `try/catch` 裡，異常只 `console.error`，絕不向上丟擲；
- 塊名寫在標記裡；同一個檔案可以有多個塊（例如 `main.js` 同時有 `menu` 和 `dialog`）；
- 安裝器集中處理追加與清理，見 `install.py` 的 `apply_blocks()`。

### 2.2 注入點

| 目標檔案 | 執行環境 | 補丁塊 | 翻譯物件 | 實現方式 |
| --- | --- | --- | --- | --- |
| `dist/preload.js` | 渲染程序（主視窗） | `engine` | 主介面全部 DOM 文本 | 追加翻譯引擎 IIFE（`engine.js` 模板 + 內嵌全量詞典） |
| `dist/ideInstall/wizardPreload.js` | 渲染程序（安裝嚮導） | `engine` | 首次啟動向導介面 | 同上 |
| `dist/menu.js` | 主程序 | `menu` | 原生選單欄、系統匣選單 | 執行時包裝 `Menu.setApplicationMenu` 與 `Menu.buildFromTemplate`，翻譯 `label` / `role` |
| `dist/tray.js` | 主程序 | 無 | 系統匣選單 | **不追加補丁**：系統匣選單由 `Menu.buildFromTemplate` 建構，已被 `menu.js` / `main.js` 的包裝覆蓋 |
| `dist/main.js` | 主程序 | `menu`、`dialog` | 原生彈窗（退出確認、檔案選擇、錯誤框等） | 選單包裝兜底 + 包裝 `dialog.showMessageBox` 等介面 |
| `dist/loadingOverlay.js` | 主程序 | 無（特例） | 啟動載入畫面 | 在 HTML 模板字串中插入一行中文文案（錨點替換，見 2.3） |

> 檔案不存在時只打印「跳過」並繼續，不視為安裝失敗；`dist/preload.js` 是唯一的硬性要求，缺失會直接中止安裝（未改動任何檔案）。

### 2.3 各補丁塊細節

#### 引擎塊（`preload.js` / `wizardPreload.js`）

`build_engine_block()` 做三件事：

1. 讀取 `dicts/engine.js` 模板；
2. 把 `__DICT_ITEMS__` 佔位符替換成 `// ===== <TAG> =====` 註釋 + `const extraDict = { ... }` 全量詞條；
3. 用 `try { ... } catch (e) { ... }` 包住整個引擎。

其中 `TAG = "Antigravity Chinese Translation Injection v5-appendonly"`，`quick_is_patched()` 會用它（以及其他幾個歷史標記）快速判斷 asar 是否被注入過。引擎在渲染程序的隔離世界裡暴露 `window.__AG_ZH__` 除錯入口，見第 9 節。

#### 選單塊（`menu.js`、`main.js`）

`MENU_PATCH_JS` 是一個執行時包裝器：

- 用 `require("electron")` 拿到 `Menu`；
- 用 `Menu.__AG_ZH_MENU__` 標記防止重複包裝；
- 維護兩張表：`MENU_LABELS`（按 `label` 精確匹配，約 60 條）和 `MENU_ROLES`（選單項沒有 `label` 時按 `role` 補中文，約 25 條）；
- 動態文案用正則兜底：`/^(\d+) active agents?$/` → `N 個代理程式執行中`，`/^Open (.+)$/` → `開啟 X`；
- 包裝 `Menu.setApplicationMenu`：先遞迴翻譯 `menu.items` 再呼叫原函式；
- 包裝 `Menu.buildFromTemplate`：先遞迴翻譯模板陣列再呼叫原函式。

系統匣選單（`tray.js`）就是用 `Menu.buildFromTemplate` 建構的，所以系統匣標籤也被同一層包裝翻譯，**不需要單獨改 `tray.js`**。`main.js` 裡再追加一份同樣的塊，是為了覆蓋主程序其他位置建構的選單。

#### 彈窗塊（`main.js`）

`DIALOG_PATCH_JS` 包裝 Electron 的 `dialog` 介面：

- `showMessageBox` / `showMessageBoxSync`（退出確認等）；
- `showOpenDialog` / `showOpenDialogSync`、`showSaveDialog` / `showSaveDialogSync`（按鈕文案）；
- `showErrorBox`（兩個字串參數，單獨處理）。

翻譯的欄位：`title`、`message`、`detail`、`checkboxLabel`、`buttonLabel`、`buttons` 陣列。Electron 的這些介面既可能 `(options)` 也可能 `(browserWindow, options)` 呼叫，補丁用 `argOptions()` 相容兩種簽名。

#### 載入畫面（`loadingOverlay.js`，特例）

這裡是整個版本里**唯一**不是「末尾追加標記塊」的地方：它是 HTML 模板字串裡的一行可見文案。

- 優先替換已有的 `<div class="text">Loading Antigravity</div>`；
- 新版載入畫面只有 Logo 時，在 `</svg>` 之後插入一行中文 + `<!-- AG_ZH_LOADING -->` 標記；
- 插入文案**禁止包含** `$`、`` ` ``、`\` 三個字元（模板字串插值 / 轉義風險），命中則跳過；
- 錨點都找不到就跳過，不報錯、不影響安裝；
- 已含 `AG_ZH_LOADING` 標記時直接跳過，保證冪等。

### 2.4 重新安裝與舊版清理

`apply_blocks(path, blocks, engine=False)` 的執行順序：

1. 刪除 v1.4.1 及更早版本對 `menu.js` 的就地呼叫：
   `if (typeof translateMenu === "function") { menu.items.forEach(translateMenu); }`；
2. 收集清理標記，取**最早出現的位置**，從該位置截斷到檔案尾（`_truncate_tail()`）：
   - 新格式塊字首 `// ===== AG_ZH_BEGIN:`；
   - 歷史版本註釋行：`... Injection v3-full =====`、`... v2-extra =====`、`... v4-appendonly =====`；
   - 歷史選單塊起點：`const menuTranslationMap = {`；
   - 引擎檔案額外加 `(function() {` 換行 `const dictionary = {` 這個舊引擎起點；
3. `rstrip()` 後把新塊追加到檔案末尾。

效果：**引擎塊和選單塊永遠只有最新一份**，不會出現「舊引擎在前先翻譯、新詞典永不生效」的歷史問題。

少數早期版本做過就地文案替換（`main.js` 的退出確認文案、`tray.js` 的系統匣標籤、`loadingOverlay.js` 的載入文案）。這些是純字串替換、不產生重複程式碼，保留也無副作用；`loadingOverlay.js` 檢測到 `AG_ZH_LOADING` 後會跳過，不重複插入。

### 2.5 原子替換與回滾副本

`swap_in()` 保證替換過程可回退：

1. 把當前 `app.asar` 複製為 `app.asar.agzh_keep.asar`；
2. 把現有 `app.asar.unpacked` 改名為 `app.asar.unpacked.agzh_old`；
3. 新 asar 先寫到同目錄暫存檔案 `app.asar.agzh_new`，再 `os.replace()` 原子替換；
4. 把新 unpacked 移動到 `app.asar.unpacked`；
5. 替換過程拋異常 → 立即恢復舊的 asar 和 unpacked。

安裝成功後 `finalize_swap()` 刪除保留副本；冒煙測試失敗時 `rollback_swap()` 把 `keep` 副本換回去。

`chrome-devtools-mcp` 仍保持 unpacked（`**/node_modules/chrome-devtools-mcp/**`），不塞進 asar。

---

## 3. 安裝主流程

`python install.py`（不帶參數）實際執行：

```text
1. detect_paths()         自動探測 app.asar；--asar 可手動指定
2. load_dictionary()      讀取詞典，計算 dict_sha256
3. kill_app()             客戶端在執行就 taskkill /IM Antigravity.exe /F /T，最多等 20 秒
4. asar.extract()         解包到臨時目錄（含 .unpacked）
5. 結構檢查              dist/preload.js 必須存在，否則中止（未改動任何檔案）
6. 讀取版本 & 判定        package.json 版本；preload 裡是否已有注入標記
7. ensure_backup()        官方原版寫 resources\app.asar.bak + 使用者目錄持久備份
8. 注入                   preload / wizard / menu / main / loadingOverlay（見第 2 節）
9. asar.pack()            重新打包到臨時目錄
10. verify_new_asar()     結構校驗：頭部可讀、檔案數一致、package.json 入口存在、
                          每個被注入檔案都含對應 BEGIN 標記；失敗退出碼 2（未改動）
11. swap_in()             原子替換（見 2.5）
12. 複製外部詞典          %USERPROFILE%\.antigravity-zh\zh-TW.json
13. smoke_test()          Windows 預設執行；--no-smoke 跳過（見第 4 節）
14. 成功 → finalize + save_state()；需要時啟動客戶端
```

幾個容易忽略的點：

- **不再要求使用者手動退出客戶端**：安裝器會自己關閉，關不掉才報「客戶端無法關閉」並以退出碼 1 結束。
- 注入 `menu.js` / `main.js` 時的異常只打印「跳過」，不影響安裝——它們是錦上添花，`preload` 引擎才是主體。
- 結構校驗在替換**之前**完成，所以校驗失敗時客戶端檔案完全沒被改動。
- 詞典同時內嵌進 asar 並複製到使用者目錄（熱重載用）。

退出碼：

| 退出碼 | 含義 |
| --- | --- |
| `0` | 成功（還原時表示「無需還原」） |
| `1` | 前置條件 / 參數錯誤（找不到 asar、客戶端無法關閉、解包失敗等） |
| `2` | 注入或結構校驗失敗，安裝中止（未改動客戶端檔案） |
| `3` | 冒煙測試失敗，已自動回滾 |
| `4` | 還原被拒（沒有可用備份，或備份版本與當前客戶端不一致） |

### 3.1 批處理指令碼與 CLI 對應

外掛包裡的 `.bat` 只是把常用參數封裝起來，行為與直接執行 `install.py` 完全一致：

| 包內指令碼 | 實際命令 | 說明 |
| --- | --- | --- |
| `安裝中文化外掛.bat` | `install.py --launch` | 完整安裝（含冒煙測試與啟動） |
| `還原官方原版.bat` | `install.py --restore` | 還原官方原版（校驗版本） |
| `中文化並啟動.bat` | `install.py --auto` | 需要時重新注入並啟動，已最新則秒開 |
| `註冊開機自動修復.bat` | `install.py --install-task` | 寫 HKCU 登錄檔 Run 項（值名 `AntigravityZhAutoRepair`） |
| `取消開機自動修復.bat` | `install.py --remove-task` | 刪除該登錄檔值並清理舊方案殘留 |
| `建立桌面捷徑.bat` | `install.py --create-shortcut` | 在桌面建立「Antigravity 中文化版」捷徑，指向 `中文化並啟動.bat` |

macOS / Linux 對應指令碼：`install-macos.sh`（安裝）、`launch-macos.sh`（`--auto`，更新後恢復）、`restore-macos.sh`（`--restore`）。

---

## 4. 冒煙測試與自動回滾

這是 v1.5.0 修復「裝完打不開」的核心機制。寫在 `install.py` 的 `smoke_test()` 裡。

### 4.1 判定流程

```text
1. 記錄客戶端主程序日誌的當前大小：
   Windows: %APPDATA%\Antigravity\logs\main.log
   macOS:   ~/Library/Application Support/Antigravity/logs/main.log
   Linux:   ~/.config/Antigravity/logs/main.log
2. start_app() 啟動客戶端，最多等 60 秒，每秒輪詢：
   - 程序消失 → 失敗「客戶端程序啟動後退出」
   - 新增日誌裡出現 Starting app (v → 記錄已啟動，再過約 6 秒確認程序仍存活
   - 已啟動且穩定存活 → 成功「客戶端已正常啟動」
   - 超時仍未看到啟動日誌 → 失敗「等待超時」
```

啟動客戶端前會清掉幾個會干擾 Electron 的環境變數：`ELECTRON_RUN_AS_NODE`、`NODE_USE_ENV_PROXY`、`ELECTRON_NO_ATTACH_CONSOLE`。Windows 下用 `DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP` 脫離安裝器程序，標準輸入輸出接 `DEVNULL`，避免安裝視窗被佔住。

### 4.2 失敗 → 回滾

```text
冒煙失敗
  → kill_app(15)：關掉剛啟動的客戶端
  → rollback_swap()：把 app.asar.agzh_keep.asar 和 .unpacked.agzh_old 換回去
  → start_app()：重新啟動官方原版，保證使用者還能用
  → （若回滾失敗：提示手動雙擊「還原官方原版.bat」）
  → die(..., 3)：退出碼 3，列印失敗原因和安裝日誌路徑
```

冒煙**成功**時客戶端保持執行（符合「裝完就能用」的預期），安裝器不會再多啟動一次。

### 4.3 開關

- 僅 Windows 預設執行；macOS / Linux 自動跳過（安裝器會列印「非 Windows 平臺跳過冒煙測試」）。
- `--no-smoke` 跳過測試，此時注入完也不會自動啟動客戶端（除非再加 `--launch`）。
- `--auto-silent` 內部會強制設定 `no_smoke = True` 且不啟動，適合登入自動修復靜默檢查。

> 跳過冒煙 = 放棄自動回滾保護。只有在你明確知道客戶端啟動異常與中文化無關時才用。

---

## 5. state.json 與 `--auto` 快速判定

### 5.1 狀態檔案

每次安裝成功寫入 `%USERPROFILE%\.antigravity-zh\state.json`：

```json
{
  "app_version": "2.32.1",
  "dict_sha256": "詞典按 key 排序後的 SHA256",
  "injected_sha256": "替換後 app.asar 的 SHA256",
  "injected_at": "2026-11-14 10:30:00",
  "toolkit_version": "1.5.0"
}
```

### 5.2 `--auto` 判定順序

```text
客戶端正在執行？
  ├─ 是（普通 --auto）→ 啟動/聚焦客戶端，返回 0
  └─ 是（--auto-silent）→ 跳過，返回 0
asar 已注入（quick_is_patched）
 且 state.dict_sha256 == 當前詞典雜湊
 且 state.app_version == 當前 asar 內 version
  ├─ 是 → 「已是最新中文化，直接啟動」，通常 1 秒內完成
  └─ 否（或未注入）→ 走完整注入流程，成功後啟動（silent 時只注入）
```

所以「客戶端自動更新後」和「詞典更新後」都會被識別為需要重新注入，而日常啟動走快速路徑。

### 5.3 開機自動修復（HKCU 登錄檔 Run 項）

`--install-task` 不寫「啟動」資料夾、也不建計劃任務，而是寫當前使用者登錄檔：

```text
鍵:   HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run
值名: AntigravityZhAutoRepair
型別: REG_SZ
資料: "<外掛目錄>\runtime\pythonw.exe" "<外掛目錄>\install.py" --auto-silent
```

- 優先用外掛包自帶的 `runtime\pythonw.exe`（無黑框）；沒有內建執行環境則退回 `runtime\python.exe`，再退回當前直譯器；
- 登入後 Windows 會執行該命令，`--auto-silent` 靜默檢查：未中文化（客戶端更新過）就重新注入，不啟動客戶端；
- 不需要管理員權限；`--status` 透過讀取該登錄檔值判斷「已註冊 / 未註冊」；
- 安裝成功後若檢測到已註冊，會自動把資料重新整理為當前外掛目錄；
- `--remove-task` 刪除該值，並順帶清理舊方案殘留（啟動資料夾裡的 `AntigravityZhAutoRepair.bat`、舊的同名計劃任務）；
- 值裡記錄的是**外掛目錄的絕對路徑**，移動或刪除外掛資料夾後自動修復會失效，需要重新註冊。

---

## 6. 還原與版本校驗

`--restore` 的判定順序（`cmd_restore()`）：

```text
1. 當前 asar 未被注入？
   → 列印「當前就是官方原版，無需還原」，退出碼 0，不碰任何檔案
2. 收集候選備份：resources\app.asar.bak、使用者目錄 app.asar.orig
   - 已被注入汙染的備份直接忽略
   - 每個候選讀取 asar 內 package.json 的 version
3. 找與當前客戶端版本一致的備份
   ├─ 找到 → 關閉客戶端 → 原子替換 → 刪除 state.json → 退出碼 0
   └─ 沒找到
       ├─ --force → 用第一個候選強制還原（不推薦）
       └─ 否則 → 拒絕並提示，退出碼 4
```

為什麼必須校驗版本：舊版 `app.asar` 裡的 preload / main 可能和新客戶端的主程序介面不相容，裝回去會打不開。

`quick_is_patched()` 的判斷依據是 asar 位元組流裡是否含以下任意一個標記（asar 不壓縮，直接搜很快）：

- `Antigravity Chinese Translation Injection v5-appendonly`（當前 TAG）；
- `AG_ZH_BEGIN:engine`；
- `Antigravity Chinese Translation Injection`（v1.4.x 及更早）；
- `Antigravity-ZH`（補丁日誌字首）。

還原不修改 `app.asar.unpacked`（內容與官方原版一致，注入時也不會寫入補丁），也不刪除使用者目錄的外部詞典和備份。

---

## 7. 翻譯引擎：12 級流水線

引擎是 `dicts/engine.js` 模板，注入後執行在 `preload` 的隔離世界。核心是一個純函式 `translate(text)`。

### 7.1 初始化：四個結構

安裝時詞典被內嵌進 `preload.js`（`__DICT_ITEMS__` 佔位符替換），啟動後還會讀取外部詞典覆蓋：

```text
coreWords（內建少量） + dictionary（內嵌全量） + ~/.antigravity-zh/zh-TW.json（外部覆蓋）
                ↓
exactLookup      : 原文 → 譯文（區分大小寫，O(1)）
lowerLookup      : 小寫 → 譯文（忽略大小寫，先到先得）
tokenLookup      : 單個單詞 → 譯文（僅短句逐詞兜底）
translationCache : 600 字元以內結果快取（上限 8000 條）
```

> `lowerLookup` 採用先到先得：詞典按 key 小寫排序，因此同名不同大小寫的詞條需要在詞典裡顯式宣告（見 7.4）。

### 7.2 逐級匹配順序（命中即返回）

| 順序 | 階段 | 說明 | 例子 |
| --- | --- | --- | --- |
| 1 | 純標點節點 | 英文標點轉全形，快捷鍵上下文例外 | `?` → `？` |
| 2 | 不含英文字母 | 中文 / 數字 / 符號直接跳過（保證冪等） | `已完成` 原樣返回 |
| 3 | 純快捷鍵組合 | 只由修飾鍵 + 單鍵組成時保留原樣 | `Ctrl+Shift+P` 原樣返回 |
| 4 | 結果快取 | 600 字元以內走 LRU（上限 8000 條） | 設定頁大量重複文案 |
| 5 | 動態塊 | `Worked for 1h2m`、`Edited x +3 -1`、`N files changed`、`Explored N files` 等 | → `已工作 1 小時 2 分` |
| 6 | **精確匹配（區分大小寫）** | `exactLookup`，O(1) | `Projects` → `專案` |
| 7 | **忽略大小寫匹配** | `lowerLookup` 兜底 | `projects` → `個專案` |
| 8 | 去尾部標點再匹配 | 保留原標點並轉全形 | `Loading...` → `正在載入…` |
| 9 | 時長短語預處理 | `6 days, 23 hours` → `6 天 23 小時` | — |
| 10 | **動態正則規則** | 約 200 條整串錨定規則，處理計數、日期、配額、快捷鍵等 | `Turn 1 of 3` → `第 1 輪（共 3 輪）` |
| 11 | 安全護欄 | 超過 3 個單詞的句子、或已含中文的文本，**保持英文不硬翻** | 模型正文永不逐詞機翻 |
| 12 | 短文本逐詞兜底 | 僅當**每個** ≥2 字母的單詞都在詞典中才整句逐詞替換 | `Sign in required` → `需要登入` |

順序的意義：

- **先詞典後規則**：已校對過的固定文案不會被正則改寫；
- **先精確後忽略大小寫**：允許 `Projects` 與 `projects` 共存；
- **規則放最後**：動態規則只處理詞典覆蓋不到的、含變數的文案。

### 7.3 動態塊（模型日誌狀態）

這類文本由客戶端執行時拼接，格式固定但數值變化，用快速路徑處理：

```js
if (/^Worked for [\d smhd.]+$/.test(trimmed)) {
  return "已工作 " + fmtDuration(...);   // Worked for 1h2m → 已工作 1 小時 2 分
}
if (/^Edited .* \+\d+ -\d+$/.test(trimmed)) { ... }   // 編輯了 file (+3 -1)
if (/^\d+ files? changed$/.test(trimmed)) { ... }      // 3 個檔案已更改
if (/^Explored/.test(trimmed)) { ... }                  // 瀏覽了 12 個檔案
```

`fmtDuration` 負責緊湊時長的單位替換與補空格：

```text
1d2h3m4.5s  →  1 天 2 小時 3 分 4.5 秒
```

### 7.4 大小寫敏感的精確匹配

React 會把介面拆成多個文本節點，例如側邊欄標題 `Projects`，而設定頁的計數是 `" projects"`（前面帶空格）單獨成節點。詞典裡兩條同時存在：

```json
{
  "Projects": "專案",
  "projects": "個專案"
}
```

- `exactLookup.get("Projects")` 命中「專案」；
- `exactLookup.get(" projects")` 未命中 → `lowerLookup.get(" projects")` 命中「個專案」。

如果只保留忽略大小寫的單表，兩條會互相覆蓋（舊版本就出現過後加譯名失效）。

### 7.5 尾部標點單獨處理

英文句號、問號常被 React 拆成獨立文本節點。引擎分兩步：

1. 純標點節點：`?` → `？`（快捷鍵上下文除外，避免 `Ctrl+,` 變成 `Ctrl+，`）；
2. 整句末尾標點：先剝掉再查詞，命中後按原標點補全形：

```text
"Loading..."  →  "正在載入…"
"Delete?"     →  "刪除？"
```

### 7.6 拆分句合併（父子句兜底）

React 有時把一句話拆成多個文本節點，逐節點翻譯會得到殘句。引擎在翻譯單個文本節點前會先看父節點：

```js
if (parent.childElementCount === 0 && parent.childNodes.length >= 2) {
  const combined = parent.textContent.replace(/\s+/g, " ").trim();  // No automations yet
  const hit = exactLookup.get(combined) ?? lowerLookup.get(combined.toLowerCase());
  if (hit) {
    // 譯文寫到第一個文本節點，其餘置空（保留節點結構，不影響 React 協調）
  }
}
```

結果：`No automations yet` → `暫無自動化任務`。

### 7.7 安全護欄：寧可不翻，也不給中英夾雜

| 規則 | 目的 |
| --- | --- |
| 整句 > 3 個單詞且未命中詞典 → 原樣返回 | 避免「已失敗 to 執行」 |
| 文本已含中文 → 原樣返回 | 保證冪等，防止二次翻譯 |
| 短句逐詞兜底要求**每個** ≥2 字母單詞都在詞典裡 | `Failed to run` 不會變成「已失敗 to 執行」 |
| 純快捷鍵組合 → 原樣返回 | `Ctrl+Shift+P` 保持可讀 |
| 程式碼 / 思考鏈 / 預覽區域 → 整塊跳過 | 自由文本不該逐詞機翻 |

### 7.8 動態規則與二次查詞

`dynamicRules` 是「整串錨定」的正則陣列（約 200 條），匹配成功的返回值支援 `$1` 與回呼：

```js
[/^Turn (\d+) of (\d+)$/i, "第 $1 輪（共 $2 輪）"],
[/^Version (.+)$/i, "版本 $1"],
[/^See\s+(\d+)\s+more$/i, "檢視另外 $1 項"],
[/^Toggle\s+(.+)$/i, function (m, name) { return "切換 " + translateCaptured(name); }],
```

`translateCaptured()` 會對捕獲到的名稱再做一次詞典查詢，避免：

```text
❌ 「New Conversation」的快捷鍵：Ctrl+Shift+O
✅ 「新建對話」的快捷鍵：Ctrl+Shift+O
```

### 7.9 外部詞典熱重載

安裝時 `install.py` 會把詞典複製到 `%USERPROFILE%\.antigravity-zh\zh-TW.json`。引擎啟動時讀取它並**覆蓋**內嵌詞典，同時 `fs.watch` 監聽檔案：

```js
fs.watch(extPath, { persistent: false }, () => setTimeout(loadExternalDict, 200));
```

修改並儲存後：

1. 200ms 防抖後重新解析；
2. `rebuildDict()` 重建四張結構並清空翻譯快取；
3. 把 `document.body` 重新入隊 → 介面逐片重翻。

所以補詞條不需要重新安裝、不需要重啟客戶端。**但熱重載只影響詞典**，改 `engine.js` 裡的動態規則仍需重新執行安裝器。

---

## 8. DOM 層：監聽、佇列、跳過

### 8.1 監聽配置

```js
new MutationObserver(handleMutations).observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["placeholder", "title", "aria-label", "value"]
});
```

- `childList` / `characterData`：新出現的文本；
- `attributes`：按鈕的無障礙標籤、輸入框佔位符（React 常用 aria-label 存文案）。

### 8.2 兩個佇列 + 空閒排程

| 佇列 | 來源 | 優先順序 |
| --- | --- | --- |
| `priorityQueue` | 新增節點、屬性變化、彈窗內容 | 先處理 |
| `pendingQueue` | 首次全量掃描 | 後處理 |

`requestIdleCallback` 每片只處理 2–10ms，處理不完繼續排隊；視窗被背景化時 `requestIdleCallback` 會被節流，因此有 `setTimeout(250ms)` 兜底。這就是設定頁上千文本節點也不卡的原因。

### 8.3 跳過規則

```js
const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, NOSCRIPT: 1, KBD: 1, SAMP: 1, VAR: 1 };
const SKIP_SELECTOR = [
  "[data-testid=\"thinking-collapsible\"]",   // 思考鏈正文
  "[data-testid=\"planner-response-text\"]",  // 模型回覆正文
  "[data-testid=\"artifact-view\"]",          // 工件預覽
  // ...
];
const TRIGGER_SELECTOR = [
  "[data-testid=\"thinking-collapsible-trigger\"]",
  "[data-testid=\"worked-for-collapsible\"]",
  "[data-testid=\"tool-group-collapsible\"]",
].join(",");
```

另外會跳過類名含 `code-line`、`select-contain`、`monaco`、`hljs`、`shiki`、`diff` 等程式碼 / 預覽區域。

例外：思考鏈容器裡的「已思考 12 秒」「已工作 1 分」觸發藥丸是系統 UI，透過 `TRIGGER_SELECTOR` 放行翻譯。

### 8.4 Shadow DOM

遇到元素帶 `shadowRoot` 時遞迴入隊，保證 Web Component 內部也能翻譯。

### 8.5 冪等性

翻譯結果不含英文字母 → `characterData` 回呼裡 `/[A-Za-z]/` 判斷不成立 → 不會再次入隊。這條規則避免「翻譯 → 觀察到變化 → 再翻譯」的死迴圈。

---

## 9. 除錯

### 9.1 日誌位置

| 日誌 | 路徑 |
| --- | --- |
| 安裝日誌 | `%USERPROFILE%\.antigravity-zh\logs\install-<時間戳>.log`（每次安裝一個） |
| 客戶端主程序日誌 | `%APPDATA%\Antigravity\logs\main.log`（冒煙測試讀的就是它） |

安裝失敗時 `install.py` 會在最後列印安裝日誌路徑。

### 9.2 檢視狀態

```bat
cd /d "C:\Users\<你>\Downloads\Antigravity中文化外掛-v1.5.0"
runtime\python.exe install.py --status
```

會輸出：安裝器版本、客戶端路徑、asar 路徑、客戶端版本、大小 / SHA256、是否已注入、是否執行中、state.json 摘要、兩處備份的版本、詞典條數與雜湊、開機自動修復（已註冊 / 未註冊）。

### 9.3 啟動 CDP 除錯

```bat
taskkill /IM Antigravity.exe /F /T
set ELECTRON_RUN_AS_NODE=
"%LOCALAPPDATA%\Programs\Antigravity\Antigravity.exe" --remote-debugging-port=9222
```

> 如果你的環境裡設定了 `ELECTRON_RUN_AS_NODE=1`，直接啟動會變成 Node 程序並報錯，必須先清掉這個變數。

### 9.4 找到隔離上下文

翻譯引擎執行在 `preload` 的隔離世界（Electron Isolated Context），普通頁面 `console` 裡存取不到 `window.__AG_ZH__`。透過 CDP `Runtime.evaluate`，選擇 Electron Isolated Context 執行：

```js
window.__AG_ZH__.translate("2 projects")    // → "2 個專案"
window.__AG_ZH__.translate("Projects")      // → "專案"
window.__AG_ZH__.version                    // → "v4"
window.__AG_ZH__.dictSize                   // → 當前詞典條數
window.__AG_ZH__.pending()                  // → 佇列裡還剩多少節點沒翻譯
```

### 9.5 定位漏翻文本

在頁面上下文裡遍歷文本節點，把仍含英文字母的節點收集出來與詞典比對：

```js
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
// 收集 t，過濾掉 t.toLowerCase() 已存在於詞典的項
```

設定頁這類大面板建議按標籤頁分批抓取，避免一次返回上千條。

---

## 10. 加詞條 / 加規則 / 加跳過

### 加一條固定文案

1. 開啟 `dicts/zh_tw.json`；
2. 插入 `"原文": "譯文"`（保持按 key 小寫排序，減少 diff 噪音）；
3. 重新安裝一次（`安裝中文化外掛.bat`，原始碼目錄為 `install-windows.bat`）讓詞典進 asar；或直接改 `%USERPROFILE%\.antigravity-zh\zh-TW.json` 熱重載預覽。

### 加一條動態文案

在 `dicts/engine.js` 的 `dynamicRules` 陣列加一行，**必須整串錨定**（`^...$`）：

```js
[/^(\d+) tasks? (?:are )?running$/i, "正在執行 $1 個任務"],
```

捕獲到名稱時用 `translateCaptured(name)` 再查詞。

### 加一條「這類區域不要翻譯」

在 `SKIP_SELECTOR` 里加 `[data-testid="..."]`，或在 `shouldSkipNode()` 里加類名判斷。

### 改完怎麼驗證

```bat
:: 1. 校驗詞典 JSON 語法
python -c "import json;json.load(open('dicts/zh_tw.json',encoding='utf-8'))"

:: 2. 重新注入（會自動重建引擎塊並重新整理外部詞典）
安裝中文化外掛.bat

:: 3. 確認已注入
python install.py --status
```

---

## 11. 已知限制

| 限制 | 原因 | 現狀 |
| --- | --- | --- |
| 模型回覆正文保持英文 | 自由文本無法整句對齊 | 設計如此 |
| 第三方外掛營銷長文保留英文 | 逐詞硬翻品質差 | 設計如此 |
| 新版本新增文案可能漏翻 | 詞典滯後於客戶端 | 提 Issue / 補詞條 |
| 極少數 React 重渲染可能短暫回英文 | 元件重掛載優先於觀察回呼 | 下一個空閒片會重翻 |
| 動態規則改動需重新安裝 | 規則在引擎裡而非外部詞典 | 有意為之（避免誤傷） |
| macOS / Linux 無冒煙測試與自動回滾 | v1.5.0 的冒煙流程只實現了 Windows | 其他平臺仍走「替換 → 手動啟動」；失敗需手動還原 |
| 選單 / 彈窗翻譯只覆蓋已知詞條 | 原生層用對映表，不是完整詞典 | 新增文案需補 `MENU_LABELS` / `DIALOG_LABELS` |

---

## 12. 安全說明

- 注入程式碼是**唯讀**的：只讀取 DOM 文本並回寫文本，不修改業務邏輯、不髮網絡請求；
- 不包含、不分發 Antigravity 的任何二進位內容（發布包裡只有本專案的原始碼與詞典）；
- 首次安裝自動備份官方原版（兩處），`--restore` 可完全還原；
- 安裝後自動冒煙測試，失敗自動回滾，最壞情況是回到安裝前的英文原版；
- 還原前校驗版本，避免舊 asar 裝到新客戶端上；
- 修改 `app.asar` 可能違反官方服務條款，風險自負。

