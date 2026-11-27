# 🀄 Antigravity 繁體中文化外掛

> 本專案是 [yunjuanyunshu114-byte/antigravity-zh-plugin](https://github.com/yunjuanyunshu114-byte/antigravity-zh-plugin)（簡體中文版）的**繁體中文（臺灣用語）版**。
> 詞典、介面提示與文件以 OpenCC `s2twp` 轉換，並針對臺灣慣用詞做了修正（例如 Agent → 代理程式、Find → 尋找、權限、帳號、進階、收件匣），轉換工具見 [`tools/s2tw_convert.py`](tools/s2tw_convert.py)。
> 安裝流程、注入方式與簡體版完全相同，可以直接取代簡體版使用。
> 另外內建 [elviscjn-cjn/antigravity-context-viewer](https://github.com/elviscjn-cjn/antigravity-context-viewer) 的**對話上下文檢視器與 Token 用量看板**（繁體中文面板），見[下方說明](#對話上下文檢視器與-token-用量看板)。

給 **Google Antigravity 桌面客戶端**（Agent Manager）裝上繁體中文介面：下載外掛包 → 解壓 → 雙擊「安裝中文化外掛.bat」。指令碼自動完成備份、注入、啟動自檢，裝完直接就是中文，頂欄同時出現上下文與 Token 用量看板。

官方客戶端自動更新後，雙擊「中文化並啟動.bat」即可自動重新中文化；也可以註冊開機自動修復，登入時自動恢復。

> ⚠️ **非官方語言包**。本工具只修改本地 `app.asar`，安裝前自動備份官方原版，可隨時還原。與 Google 及 Antigravity 官方團隊無關，使用風險自負。

| 項目 | 說明 |
| --- | --- |
| 當前版本 | **v1.8.0**（繁體中文版，基於上游 v1.7.0） |
| 上游簡體版 | [yunjuanyunshu114-byte/antigravity-zh-plugin](https://github.com/yunjuanyunshu114-byte/antigravity-zh-plugin) |
| 上下文看板 | [elviscjn-cjn/antigravity-context-viewer](https://github.com/elviscjn-cjn/antigravity-context-viewer) **v0.9.3**（MIT），面板預設繁體中文 |
| 已驗證客戶端 | Antigravity **2.35.1**、**2.35.2**（Windows 實測；macOS / Linux 提供同邏輯指令碼） |
| 詞典規模 | 7,614 條整句詞條 + 314 條動態正則規則 |
| 外掛包 | 約 **12 MB**，內建 Windows 免安裝 Python 執行環境；看板使用 Antigravity 內建的 Node，不必另裝 |
| 舊版備份（簡體，上游） | **v1.5.0**（適配 Antigravity 2.32.1）：[原始碼備份分支 `backup/v1.5.0`](https://github.com/yunjuanyunshu114-byte/antigravity-zh-plugin/tree/backup/v1.5.0) · [Release 下載](https://github.com/yunjuanyunshu114-byte/antigravity-zh-plugin/releases/tag/v1.5.0) |
| 許可證 | [MIT](LICENSE)；看板見 [`context-viewer/LICENSE`](context-viewer/LICENSE)（MIT） |

---

## 目錄

- [三步快速開始](#三步快速開始)
- [對話上下文檢視器與 Token 用量看板](#對話上下文檢視器與-token-用量看板)
- [客戶端更新後怎麼辦](#客戶端更新後怎麼辦)
- [命令與參數](#命令與參數)
- [工作原理](#工作原理)
- [故障排查](#故障排查)
- [常見問題](#常見問題)
- [術語表](#術語表)
- [更新日誌](#更新日誌)
- [給開發者](#給開發者)

---

## 三步快速開始

### 第一步：下載外掛包

開啟 [Releases](https://github.com/libertydragonn/antigravity-zh-tw-plugin/releases/latest)，下載
**`Antigravity-zh-TW-plugin-v1.8.0.zip`**（約 12 MB）。

> 下載後可以用同一頁面提供的 `.sha256` 檔案校驗完整性，見[殺軟誤報或下載被攔截](#殺軟誤報或下載被攔截)。

### 第二步：解壓

把 zip 解壓到任意位置（例如 `D:\Tools\`），得到資料夾 **`Antigravity中文化外掛-v1.8.0`**。

外掛包已內建 Python 執行環境，**不需要 git、不需要命令列、不需要自己裝 Python**。

### 第三步：雙擊「安裝中文化外掛.bat」

1. 雙擊 **`安裝中文化外掛.bat`**
2. 指令碼自動：關閉正在執行的 Antigravity → 解包 `app.asar` → 注入中文化 → 重新打包 → 寫入上下文看板 → 啟動客戶端自檢
3. 看到中文介面即安裝成功；若自檢失敗，指令碼會自動回滾官方原版並告訴你原因（詳見[工作原理](#工作原理)）

還原英文原版：雙擊 **`還原官方原版.bat`**。

macOS / Linux 解壓後執行 `./install-macos.sh`（安裝）、`./launch-macos.sh`（更新後恢復）、`./restore-macos.sh`（還原），需系統自帶 `python3`。

> 💡 **把這個外掛資料夾留在硬碟上**。客戶端每次自動更新都會覆蓋中文化，留著外掛包就能隨時一鍵恢復。

---

## 對話上下文檢視器與 Token 用量看板

外掛包內建 [elviscjn-cjn/antigravity-context-viewer](https://github.com/elviscjn-cjn/antigravity-context-viewer) v0.9.3（MIT）的看板，安裝中文化時一起裝好，面板預設為繁體中文。安裝後 Antigravity 右上角頂欄會出現一排指標，點一下即可展開面板：

| 功能 | 說明 |
| --- | --- |
| 上下文監控 | 目前對話已用的 Token 與剩餘空間；可依模型分別設定上下文長度 |
| 模型額度 | 頂欄圓環顯示剩餘額度；展開可看共享額度池、5 小時 / 每週額度與重置時間 |
| 生成速度 | 輸出速度（tok/s）、首字延遲、生成耗時與本次輸出 Token |
| 對話明細 | 提示詞、回覆、思考與工具呼叫的 Token 統計 |
| 歷史用量 | 桌面端與 CLI 的累計 Token 用量、不同週期統計與活躍熱力圖 |
| 費用參考 | 依已記錄用量估算 API 費用並與訂閱比較（僅供參考，不是實際扣費） |

- **安裝 / 移除**：`安裝中文化外掛.bat` 預設會一起安裝看板。不想要看板就雙擊 **`移除上下文看板.bat`**（中文化保留），想裝回來雙擊 **`安裝上下文看板.bat`**。你的選擇會被記住，之後「中文化並啟動.bat」與開機自動修復都照這個選擇處理。
- **不必另外安裝 Node.js**：看板需要 Node.js 22.4 以上；電腦裡有就用系統的 Node，沒有就用 Antigravity 本身內建的 Node 執行。
- **安裝順序與備份**：先注入中文化、再寫入看板，最後一次冒煙測試同時驗證兩者，失敗會一起回滾。官方原版備份只保存「沒有中文化、也沒有看板」的檔案，所以「還原官方原版.bat」會把兩者一起移除。
- **面板語言**：第一次安裝時把面板設為繁體中文；之後你在面板裡改選的語言會被保留。
- **連線對象**：看板讀取本機對話紀錄計算用量。依程式碼中的網址，它會連線到 Google 官方 API（`cloudcode-pa.googleapis.com`，使用 Antigravity 現有的登入狀態查詢模型額度）、`models.dev` 與 GitHub（取得模型價格表、檢查看板更新）；本機 API 只監聽 `127.0.0.1`。
- **進階選項預設關閉**：看板設定頁裡的客戶端漢化（簡體）、免 TUN 本地代理、系統提示詞檔位、上下文長度解鎖、多帳號自動切換等功能來自上游，預設全部關閉。「上下文長度解鎖」會修改 Antigravity 的 language server，「提示詞檔位」會改寫系統提示詞，開啟前請先看上游說明，風險自負。**看板自己的「客戶端漢化」請保持關閉**，以免和本外掛的繁體翻譯互相覆蓋。
- **與上游的差異**：看板以按鈕標籤定位部分介面，上游只認英文與簡體，本外掛補上繁體標籤（傳送、麥克風、自訂、開啟 IDE 等）；未附上游未簽章的 `cli-window-helper.exe`，從看板啟動 CLI 時會改用一般命令提示字元視窗。詳見 [`context-viewer/UPSTREAM.md`](context-viewer/UPSTREAM.md)。

---

## 客戶端更新後怎麼辦

Antigravity 自動更新時，官方 `app.asar` 會覆蓋中文化補丁——這是正常現象，不是安裝失敗。

### 方案一：雙擊「中文化並啟動.bat」（最快）

1. 開啟外掛包資料夾
2. 雙擊 **`中文化並啟動.bat`**
3. 指令碼會自動判斷：已中文化且客戶端版本、詞典都沒變 → 直接開啟客戶端（通常 1 秒內）；客戶端剛更新過 → 自動重新注入，再開啟客戶端
4. 等待介面變成中文即可

> macOS / Linux 使用者執行 `./launch-macos.sh`，效果相同（等價於 `install.py --auto`）。

### 方案二：註冊開機自動修復（一勞永逸）

雙擊 **`註冊開機自動修復.bat`**，會在當前使用者的登錄檔啟動項裡登記一條命令：
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`，值名 `AntigravityZhAutoRepair`。
以後每次登入系統都會靜默檢查：發現中文化沒了（客戶端更新過）就自動重新安裝，不用再手動操作。
不需要管理員權限，也不會往「啟動」資料夾裡寫 .bat（那種方式會被安全軟體攔截）。
重新安裝中文化時，如果之前註冊過，會自動把啟動項重新整理為當前外掛目錄。

不想用了就雙擊 **`取消開機自動修復.bat`**。

### 方案三：完整重新安裝

雙擊 **`安裝中文化外掛.bat`** 重新執行完整安裝流程（重新備份、注入、自檢、啟動）。

### 關於備份

官方原版始終保留兩份，客戶端更新清掉一份也不會丟：

| 備份位置 | 作用 |
| --- | --- |
| `Antigravity\resources\app.asar.bak` | 安裝目錄內的就地備份 |
| `%USERPROFILE%\.antigravity-zh\backup\app.asar.orig` | 使用者目錄持久備份，**客戶端更新清空 `resources\` 也不會丟** |

此外外掛包還提供 **`建立桌面捷徑.bat`**：在桌面建立名為「Antigravity 中文化版」的捷徑，指向 `中文化並啟動.bat`，以後從桌面雙擊即可自動重新中文化並開啟客戶端。

---

## 命令與參數

批處理指令碼已經封裝了常用組合，普通使用者不需要命令。需要精細控制時，在外掛包目錄（或原始碼目錄）執行
`python install.py <參數>`；外掛包內可用自帶的 `runtime\python.exe`：

```bat
cd /d "C:\Users\<你>\Downloads\Antigravity中文化外掛-v1.8.0"
runtime\python.exe install.py --status
```

| 參數 | 作用 | 什麼時候用 |
| --- | --- | --- |
| `--auto` | 智慧模式：狀態檔案表明已中文化且客戶端版本、詞典雜湊都沒變 → 直接啟動（通常 <1 秒）；否則重新注入後啟動 | 「中文化並啟動.bat」內部使用；客戶端更新後恢復中文化 |
| `--auto-silent` | 智慧模式，但**只注入、不啟動**客戶端 | 開機自動修復（登入啟動項）、指令碼背景修復 |
| `--launch` | 注入完成後啟動客戶端 | 希望裝完立刻開啟 |
| `--no-smoke` | 跳過安裝後的冒煙自檢 | 自動啟動客戶端被環境禁止時排障（**不推薦**，會失去自動回滾保護） |
| `--status` | 列印狀態：是否已注入、兩處備份、客戶端版本、狀態檔案摘要 | 排查「到底裝沒裝」 |
| `--restore` | 還原官方原版（還原前校驗客戶端版本） | 徹底去掉中文化 |
| `--force` | 與 `--restore` 合用：允許用客戶端版本不一致的舊備份還原 | 確認要用舊版本備份恢復時 |
| `--install-task` | 在 HKCU 登錄檔 Run 項登記登入自動修復（值名 `AntigravityZhAutoRepair`） | 客戶端經常自動更新 |
| `--remove-task` | 刪除該登錄檔值（並清理舊方案殘留） | 不再需要自動修復 |
| `--create-shortcut` | 在桌面建立「Antigravity 中文化版」捷徑（指向 `中文化並啟動.bat`） | 想從桌面直接啟動並自動修復 |
| `--install-viewer` | 安裝中文化並加裝上下文看板，之後保持開啟 | 「安裝上下文看板.bat」內部使用 |
| `--remove-viewer` | 移除看板：還原官方原版後只重新安裝中文化，之後不再安裝看板 | 「移除上下文看板.bat」內部使用 |
| `--no-viewer` | 本次安裝不含看板（不改變記住的選擇） | 排查相容性問題 |
| `--asar PATH` | 手動指定 `app.asar` 路徑 | 客戶端裝在非預設位置 |
| `--version` | 列印安裝器版本 | 確認外掛包版本 |

補充說明：

- **不加參數**執行 `install.py` = 完整安裝；Windows 下預設在替換 `app.asar` 後啟動客戶端做冒煙自檢，成功後客戶端保持執行。
- 需要手動指定非預設安裝位置時，可加 `--asar "D:\Portable\Antigravity\resources\app.asar"`。
- **退出碼**：`0` 成功或無需操作；`1` 前置條件 / 參數錯誤（如找不到 `app.asar`、客戶端無法關閉）；`2` 注入或結構校驗失敗，安裝中止（未改動客戶端檔案）；`3` 冒煙測試失敗，已自動回滾；`4` 還原被拒（沒有可用備份，或備份版本與當前客戶端不一致）。
- `--install-task` / `--remove-task` 僅 Windows 可用：前者寫 HKCU 登錄檔 Run 項，後者刪除該值。它的值優先指向外掛包自帶的 `runtime\pythonw.exe`（無黑框）；外掛目錄被移動或刪除後會失效，需要重新註冊。
- `--help` 可檢視全部參數說明。

---

## 工作原理

整體思路：**不改客戶端業務程式碼**，只往 Electron 的幾個入口檔案末尾追加一層唯讀的翻譯執行時，讓渲染程序翻譯介面文本、讓主程序翻譯原生選單和彈窗。

### 1. 只追加註入，不改原始碼

安裝器解包 `app.asar` 後，只往目標檔案**末尾追加**帶標記的補丁塊，不做任何就地字串替換（`loadingOverlay.js` 的載入文案是唯一例外，見 [HOW_IT_WORKS](docs/HOW_IT_WORKS.md)）：

```js
// ===== AG_ZH_BEGIN:engine =====
try {
  ...補丁程式碼...
} catch (e) { /* 只寫日誌，不影響客戶端 */ }
// ===== AG_ZH_END:engine =====
```

重新安裝時按標記 / 錨點定位，從錨點處整體重建：v1.4.1 及更早版本留下的追加式引擎塊、選單補丁塊會被清除後重寫，不會出現新舊引擎疊加、新詞典永不生效的問題。

### 2. 失敗隔離

每個補丁塊整體包在 `try/catch` 裡：補丁自身出錯只記錄日誌，**絕不讓主程序或預載入指令碼崩潰**。這是 v1.5.0 修復「裝完客戶端打不開」的核心改動。

### 3. 安裝後冒煙測試 + 自動回滾

替換 `app.asar` 後，安裝器會清空 `ELECTRON_RUN_AS_NODE` 環境變數並啟動客戶端做自檢：

- **透過**：安裝器先記錄客戶端主程序日誌 `%APPDATA%\Antigravity\logs\main.log` 當前的位元組位置，再啟動客戶端；60 秒內輪詢到**新增日誌裡出現 `Starting app (v`** 且 `Antigravity.exe` 穩定存活（約 6 秒）→ 安裝成功，客戶端保持執行
- **失敗**：程序提前消失或超時 → 殺掉程序 → 用替換前保留的官方原版（`app.asar` + `app.asar.unpacked`）回滾 → 重新啟動官方版 → 以退出碼 `3` 結束並給出中文原因

也就是說：**最壞情況是回到安裝前的英文原版，而不是留下一個打不開的客戶端。**

`--no-smoke` 可以跳過這一步，但會失去自動回滾保護，僅建議排障時使用。

### 4. 雙備份

安裝時把官方原版複製到 `resources\app.asar.bak`，同時另存一份到
`%USERPROFILE%\.antigravity-zh\backup\app.asar.orig`（含客戶端版本、大小、SHA256、時間）。
客戶端更新會整體替換 `resources\` 目錄，但使用者目錄那份不受影響。

### 5. 還原版本校驗

還原前會比對「當前 `app.asar` 內 `package.json` 的版本」與「備份 `app.asar` 內版本」：

- 版本一致 → 正常還原
- 版本不一致（說明客戶端已升級，舊備份可能是上一版）→ **預設拒絕還原**（退出碼 `4`）並提示先重新安裝或修復；確認要用舊備份恢復時加 `--force`
- 當前本來就是官方原版 → 提示「無需還原」，退出碼 `0`

### 6. 快速判定：狀態檔案

每次注入後會寫狀態檔案 `%USERPROFILE%\.antigravity-zh\state.json`：

```json
{
  "app_version": "2.35.1",
  "dict_sha256": "…",
  "injected_sha256": "…",
  "injected_at": "2026-11-25 09:30:00",
  "toolkit_version": "1.8.0"
}
```

`--auto` 先讀這個檔案：當前 asar 已注入，且狀態檔案記錄的 `dict_sha256` 與本版詞典一致、`app_version` 與當前客戶端版本一致，就直接啟動（通常 1 秒內完成）；否則重新注入後再啟動。這就是「客戶端更新後雙擊一次即可」的實現方式。

### 7. 注入點一覽

| 檔案 | 執行環境 | 翻譯物件 |
| --- | --- | --- |
| `dist/preload.js` | 渲染程序（主介面） | 全部介面文本、`placeholder`、`title`、`aria-label` |
| `dist/ideInstall/wizardPreload.js` | 渲染程序（安裝嚮導） | 首次啟動向導介面 |
| `dist/menu.js` | 主程序 | 原生選單欄；同時包裝 `Menu.buildFromTemplate`，系統匣選單 label 也在這裡統一翻譯 |
| `dist/tray.js` | 主程序 | **不追加補丁塊**，系統匣選單 label 由 `menu.js` 的選單包裝統一翻譯 |
| `dist/main.js` | 主程序 | 原生彈窗（退出確認等）、選單兜底 |
| `dist/loadingOverlay.js` | 主程序 | 啟動載入畫面文案 |

注入的實現細節、翻譯流水線的 12 個階段、冒煙測試與回滾流程、`state.json` 判定邏輯，見 [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)。

---

## 故障排查

### 雙擊安裝後客戶端打不開

v1.5.0 起安裝器自帶冒煙自檢：如果注入後客戶端起不來，會自動回滾官方原版並重新啟動，最後以**退出碼 3**結束，命令列視窗中能看到中文原因。

按順序處理：

1. 看安裝視窗最後幾行提示，按提示操作（通常會告訴你已回滾到官方原版）。
2. 雙擊 **`還原官方原版.bat`** 再確認一次（當前已是官方原版時會提示「無需還原」）。
3. 仍打不開：在 Antigravity 裡執行「修復 / 重新安裝」，讓官方重新下發檔案。
4. 需要更多資訊時，檢視安裝日誌 `%USERPROFILE%\.antigravity-zh\logs\install-*.log`、客戶端日誌 `%APPDATA%\Antigravity\logs\main.log`，或執行 `runtime\python.exe install.py --status` 檢視注入與備份狀態。

> 不要手動刪除 `app.asar.bak` 或 `%USERPROFILE%\.antigravity-zh\backup\`，那是回滾用的官方原版。

### 裝完介面還是英文

1. **確認客戶端已完全退出後重新開啟**（包括系統匣圖示裡的常駐程序），舊程序不會載入新介面。
2. 確認安裝視窗顯示的是成功，而不是「跳過」或「回滾」。
3. 執行 `runtime\python.exe install.py --status`，看到 `中文化: 已注入` 說明補丁在。
4. 如果客戶端剛自動更新過，說明官方檔案覆蓋了補丁：雙擊 **`中文化並啟動.bat`** 重新注入。
5. 只有部分英文：模型回覆正文、程式碼塊、diff 按設計保持英文；如果是介面按鈕/選單的英文，屬於詞典未覆蓋，歡迎反饋原文。

### 客戶端自動更新後中文化消失（正常現象）

客戶端自動更新時會把 `resources\` 目錄整體替換，中文化補丁隨之被官方檔案覆蓋，介面回到英文——**這不是裝壞了**。恢復方式：雙擊 **`中文化並啟動.bat`** 重新注入並開啟；或者提前註冊開機自動修復，登入時自動恢復。

### 還原時提示「備份版本與當前客戶端不一致」

還原只接受與當前客戶端版本一致的官方備份，避免把上一版 `app.asar` 還原到新客戶端上導致打不開。遇到這個提示：優先雙擊 **`安裝中文化外掛.bat`** 重新生成與當前版本匹配的備份，或在 Antigravity 裡執行「修復 / 重新安裝」；確認要用舊備份恢復再加 `--force`。

### 殺軟誤報或下載被攔截

外掛包含批處理指令碼和免安裝 Python 執行環境，執行時會寫入 `app.asar`，可能被 Windows Defender 或第三方防毒軟體誤報、攔截甚至隔離：

- **下載被瀏覽器/SmartScreen 攔截**：選擇「保留」，或用 Release 頁面提供的 `.sha256` 校驗檔案：

  ```bat
  certutil -hashfile "C:\Users\<你>\Downloads\Antigravity-zh-TW-plugin-v1.8.0.zip" SHA256
  ```

  與 `.sha256` 檔案裡的值一致即可放心。
- **執行時被攔截**：把解壓出來的外掛資料夾加入殺軟白名單，從隔離區恢復被刪的檔案後重新解壓嘗試。
- **不要長期關閉殺軟**來安裝；如果安裝目錄需要管理員權限（自訂安裝到 `Program Files` 時），右鍵以管理員身份執行指令碼。

### 如何徹底還原

1. 雙擊 **`還原官方原版.bat`**（或 `python install.py --restore`）。
2. 雙擊 **`取消開機自動修復.bat`**，移除開機自動修復登錄檔項（如果註冊過）。
3. 可選：刪除 `%USERPROFILE%\.antigravity-zh\`（狀態檔案、外部詞典、備份都在這）和桌面捷徑。
4. 最徹底：在 Antigravity 中執行「修復 / 重新安裝」，用官方檔案覆蓋整個 `resources\`。

還原只替換 `app.asar`，不會動你的帳號、專案和客戶端設定。

---

## 常見問題

**Q：這個外掛收費嗎？**
A：不收費，[MIT 協議](LICENSE) 開源。

**Q：會不會影響客戶端功能？會被風控嗎？**
A：補丁只讀取並回寫介面文本，不攔截網路請求、不改業務狀態；但修改 `app.asar` 本身可能違反官方服務條款，請自行評估。

**Q：支援哪些系統？**
A：Windows 已適配至 Antigravity 2.35.1；macOS / Linux 提供同一套注入邏輯的 `install-macos.sh` / `restore-macos.sh`，未做同版本實測。

**Q：為什麼不能在設定裡直接選中文？**
A：Antigravity 官方目前沒有中文介面選項，本外掛透過注入翻譯執行時實現。

**Q：客戶端每次更新都要重新裝一遍嗎？**
A：是。更新會覆蓋 `app.asar`。雙擊「中文化並啟動.bat」一次即可；想一勞永逸就註冊開機自動修復。

**Q：能不能只中文化、不自動開啟客戶端？**
A：可以。原始碼目錄下 `python install.py --auto-silent`（或 `--no-smoke`）只注入不啟動。

**Q：外掛會收集或上傳我的資料嗎？**
A：中文化本身只在本機讀寫 `app.asar` 和本地詞典，不聯網、不上傳介面內容。上下文看板的連線對象見[看板說明](#對話上下文檢視器與-token-用量看板)；不需要看板時雙擊「移除上下文看板.bat」。

**Q：怎麼自己補詞條？**
A：編輯 `%USERPROFILE%\.antigravity-zh\zh-TW.json`（儲存後介面會自動重翻，無需重新安裝）；要進發布包則改原始碼的 `dicts/zh_tw.json`。詳見 [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)。

**Q：不想用了怎麼解除安裝？**
A：見[如何徹底還原](#如何徹底還原)，然後刪除外掛資料夾即可。

**Q：為什麼有兩份官方原版備份？**
A：客戶端更新會清空 `resources\` 目錄，安裝目錄裡的 `.bak` 可能被刪；使用者目錄那份保證任何時候都能還原。

**Q：開機自動修復為什麼用登錄檔，而不是「啟動」資料夾？**
A：把 .bat 寫進「啟動」資料夾會被部分安全軟體攔截（實測報 Permission denied）；寫當前使用者登錄檔 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 不需要管理員權限，更穩定可靠。

**Q：macOS 提示「應用已損壞，無法開啟」？**
A：`sudo xattr -rd com.apple.quarantine /Applications/Antigravity.app`；安裝器也會自動做 ad-hoc 重簽名。

---

## 術語表

外掛與文件中統一使用以下譯名：

| 英文 | 譯名 | 說明 |
| --- | --- | --- |
| Artifact | 工件 | 客戶端產出的檔案 / 預覽內容 |
| Worktree | 工作樹 | Git 工作樹 |
| Sandbox | 沙箱 | 執行環境 |
| Review | 審查 | 程式碼 / 變更審查 |
| Fork | 分叉 | 對話分叉 |
| Agent | 代理程式 | 執行任務的 AI 例項 |
| Subagent | 子代理程式 | 由主代理程式派生的子任務例項 |
| Quota | 配額 | 請求次數限制 |
| Credits | 額度 | 計費額度 |
| Customizations | 自訂（擴充功能） | 技能 / 外掛等擴充功能配置 |
| Automations | 自動化 | 定時或觸發的任務 |
| Workspace | 工作區 | 專案集合 |

文件中的技術詞：

| 詞 | 含義 |
| --- | --- |
| asar | Electron 應用歸檔格式，客戶端程式碼都打包在 `app.asar` 裡 |
| 注入 | 往 asar 裡的入口檔案追加中文化補丁程式碼 |
| 補丁塊 | 帶有 `AG_ZH_BEGIN` / `AG_ZH_END` 標記的一段追加程式碼 |
| 冒煙測試 | 安裝後自動啟動客戶端、確認沒被裝壞的自檢 |
| 回滾 | 自檢失敗時自動恢復備份的官方原版 |
| state.json | 記錄注入結果的快速判定檔案，`--auto` 靠它秒開 |

---

## 更新日誌

### v1.8.0 繁體中文版（2026-11-27）

- **內建對話上下文檢視器與 Token 用量看板**：整合 [elviscjn-cjn/antigravity-context-viewer](https://github.com/elviscjn-cjn/antigravity-context-viewer) v0.9.3（MIT），安裝中文化時一起寫入，面板預設繁體中文；可用「移除上下文看板.bat」/「安裝上下文看板.bat」切換
- **看板繁體相容**：在看板定位介面元素的比對處補上繁體標籤（傳送、麥克風、自訂、開啟 IDE、權限、極速），原有英文與簡體比對保留
- **安裝器**：新增 `--install-viewer`、`--remove-viewer`、`--no-viewer`；先中文化再寫入看板、一次冒煙測試驗證兩者；官方原版備份與還原會排除含看板的檔案；沒有系統 Node 時改用 Antigravity 內建 Node
- **實測**：Windows / Antigravity 2.35.2 安裝、移除、重新安裝看板皆通過冒煙測試，系統 Node 與 Antigravity 內建 Node 兩條路徑都驗證過

### v1.7.0.1 繁體中文版（2026-11-27）

- **同步上游 macOS 修正**（上游 PR #1，2026-11-26）：修正 `.app` 路徑識別，補上 ad-hoc 重簽名與 Electron ASAR 完整性 Fuse 檢查（Windows 行為不變）
- **修正誤轉**：表示「通過（pass）」的「校驗通過」「未通過」等不再被轉成「透過」
- **實測**：Windows / Antigravity 2.35.2 安裝成功，冒煙測試通過，介面為繁體中文

### v1.7.0 繁體中文版（2026-11-27）

- **簡體 → 繁體（臺灣用語）**：以上游 v1.7.0 為基礎，用 OpenCC `s2twp` 轉換全部 7,614 條詞典譯文、314 條動態規則、安裝器提示、批次檔與文件；詞典的「鍵」（客戶端英文原文）保持不變
- **臺灣慣用詞修正**：Agent → 代理程式（「代理」保留給 Proxy）、權限、存取、帳號/帳戶、自訂、進階、收件匣、存放庫、終端機、尋找、背景執行、捷徑、投影片、唯讀、電腦等；中文字串裡的 “” 改為「」
- **檔名改為繁體**：`安裝中文化外掛.bat`、`中文化並啟動.bat`、`還原官方原版.bat` 等；詞典改名為 `dicts/zh_tw.json`，外部詞典改為 `%USERPROFILE%\.antigravity-zh\zh-TW.json`
- **從簡體版升級**：已裝過簡體版時直接執行本版安裝即可，翻譯引擎與載入畫面提示都會換成繁體；官方原版備份與簡體版共用，仍可一鍵還原

### v1.7.0（2026-11-25）

- **適配 Antigravity 2.35.1**：提取並補齊 2.35.1 新增 UI 詞條（收件匣模式 `Inbox Mode` / `Auto-Resolve` / `Working Section`、語音聽寫語言、外掛權限 `Plugin permissions`、編排器模型選擇、雲端對話與從遠端克隆等），同步補充 `install.py` 原生彈窗靜態詞條與遠端組織登入提示正則規則
- **外掛市場詳情頁 & README 富文本中文化**：`dicts/engine.js`（v5.1）新增 React 安全內聯模板匹配器 `tryRichInlineSentence`，在不改動 DOM 節點結構的前提下整句翻譯含 `<strong>`/`<a>`/`<code>` 等內聯標籤的 Markdown 段落；同步補全全部 15 條外掛市場目錄缺失描述、72 條官方推薦提示詞，以及官方快取外掛（`Google Developer Knowledge`、`Gemini API`、`Android CLI`、Google Workspace 套件）詳情頁與 README 核心說明
- **詞典與規則規模**：詞典由 7,298 條擴充至 **7,614** 條（+316 條），動態正則規則擴充至 **314** 條

### v1.6.0（2026-11-21）

- **全面適配 Antigravity 2.34.0**：從新版客戶端內建前端全量提取並補齊 UI 詞條，詞典由 6,360 條擴充至 **7,298** 條（+938 條），動態規則擴充至 **306** 條
- **修復模型選擇器 & 推理強度顯示**：補全 `Extra High -> 超高`、`XHigh -> 超高`、`Minimal -> 極低`、`Max -> 最高`、`Orchestrator -> 編排器` 及其設定頁與模型+推理強度組合規則；修復 `New` 在徽章與新建按鈕間的上下文歧義（徽章譯「新」，按鈕譯「新建」）；規範 `Notice -> 提示`、`Fast -> 快速`、`Medium -> 中等`、`GPT-OSS 120B (Medium) -> GPT-OSS 120B (中等)`
- **徹底解決對話右鍵選單漏翻**：擴充主程序 `MENU_LABELS` 與動態規則覆蓋 `window.electronNative.showContextMenu` 全部右鍵項（`Pin`、`Mark Read/Unread`、`Split`、`Split Right/Down`、`Archive`、`Move to Group`、`Telemetry` 等），接入外部詞典 `%USERPROFILE%\.antigravity-zh\zh-TW.json` 熱重載，並同步包裝 `Tray.prototype.setContextMenu` 與 macOS 更新選單點選回呼
- **詞典規範化與防誤拼加固**：統一解決 70 處大小寫衝突（統一 `Conversation -> 對話`、`Mark Read/Unread -> 標為已讀/未讀`、`Worktree -> 工作樹` 等術語），清理短標籤冗餘英文括號與斜槓雙譯；為 `engine.js` 的 `tokenLookup` 增加停用詞與譯文長度過濾，杜絕 `Remove from Recent` 等短語逐詞亂拼
- **安裝器修復**：`apply_blocks` 改為按成對 `AG_ZH_BEGIN/END` 標記精確替換，更新重新安裝時完整保留其他第三方外掛補丁（如 `GEMINI_NEKO_HUD`）；修復 `DIALOG_PATCH_JS` 迴圈閉包 Bug 並補全 2.34.0 原生彈窗靜態與動態規則

### v1.5.0（2026-11-14）（舊版備份，原始碼見 [`backup/v1.5.0`](https://github.com/yunjuanyunshu114-byte/antigravity-zh-plugin/tree/backup/v1.5.0) 分支）

- **修復「裝完客戶端打不開」**：注入架構改為「**只追加 + `try/catch` 失敗隔離**」。補丁只追加在檔案末尾並整體包在異常捕獲裡，出錯只寫日誌，不會讓預載入或主程序崩潰
- **安裝後自動冒煙測試 + 回滾**：替換 `app.asar` 後自動啟動客戶端，60 秒內必須出現新的啟動日誌且程序穩定存活；失敗則自動用替換前保留的官方原版回滾、重新開啟官方版，退出碼 `3` 並給出中文提示。最壞情況是回到英文原版，不會留下打不開的客戶端
- **新增「中文化並啟動.bat」**：客戶端更新後雙擊一次，自動判斷是否需要重新注入並開啟客戶端（已是最新則直接開啟，通常 1 秒內）
- **新增「註冊開機自動修復.bat / 取消開機自動修復.bat」**：寫入 HKCU 登錄檔 Run 項（值名 `AntigravityZhAutoRepair`，無需管理員權限），登入時自動檢查並重新中文化；不用「啟動」資料夾裡的 .bat（會被安全軟體攔截）
- **新增 `--auto` 快速重新安裝**：智慧模式，已中文化且詞典、客戶端版本都沒變就直接啟動，否則注入後啟動；配套 `--auto-silent`（只注入不啟動）、`--launch`（注入後啟動）、`--no-smoke`（跳過自檢）
- **安裝成功後客戶端保持執行**，符合「裝完就能用」的預期
- **還原保護**：還原前比對當前 `app.asar` 與備份 `app.asar` 內 `package.json` 的客戶端版本，版本不一致預設拒絕並提示先重新安裝/修復，`--force` 才允許強制還原；當前已是官方原版時提示「無需還原」並正常退出
- **相容清理**：重新安裝時按標記 / 錨點清除 v1.4.1 及更早版本的引擎與選單注入塊後重建，不會殘留重複引擎導致新詞典不生效
- **新增安裝包指令碼**：`中文化並啟動.bat`、`建立桌面捷徑.bat`、`註冊開機自動修復.bat`、`取消開機自動修復.bat`
- **翻譯補全**：6297 → **6359** 條（合併實測掃描出的 62 條 UI 缺口，含設定頁說明長句、快捷鍵動作名、語音選擇彈窗、外掛市場/技能描述）；動態規則 190 → 200 條（相對時間縮寫、Select project、Open 檔案、Worked for · N updates、語音序號、模型名 + 限額等）；修掉實測發現的 20+ 處中英混排
- 已驗證客戶端 **2.32.1**

### v1.4.1 及更早（歸檔）

- **v1.4.1**：改為外掛包（內建 Python 執行環境，解壓雙擊即裝），新增使用者目錄持久備份；修復 `.bak` 被客戶端更新清掉後無法還原、批處理輸出亂碼
- **v1.4.0**：適配 Antigravity 2.31，詞典 5982 → 6297；精確匹配優先 + 忽略大小寫兜底、拆分句合併、載入畫面文案
- **v1.3.x**：詞典 1855 → 5982；新增動態正則規則層與 `fmtDuration`；修復重複引擎塊導致新詞典永不生效
- **v1.2.0 / v1.1.x / v1.0.0**：術語統一、asar 原子替換與 macOS 重簽名修復、純 Python asar 解析與一鍵安裝 / 還原

---

## 給開發者

### 從原始碼執行

```bat
git clone https://github.com/libertydragonn/antigravity-zh-tw-plugin.git
cd antigravity-zh-tw-plugin

python install.py --auto                       :: 智慧安裝（需要時注入並啟動）
python install.py --status                     :: 檢視狀態
python install.py --restore                    :: 還原官方原版
python install.py --restore --force            :: 版本不一致也強制還原
python install.py --install-task               :: 註冊開機自動修復
python install.py --remove-task                :: 取消開機自動修復
python install.py --create-shortcut            :: 建立桌面捷徑
python install.py --version                    :: 安裝器版本
python install.py --asar "D:\Portable\Antigravity\resources\app.asar"   :: 手動指定路徑
```

> 存放庫不含 `runtime\`（免安裝 Python），從原始碼執行需要系統已安裝 Python 3.8+。批次檔會優先使用 `runtime\python.exe`，找不到時改用系統的 `python` / `py`。

### 打包發布

外掛包 = 存放庫內容 + `runtime\`（Windows 免安裝 Python 執行環境）。[Releases](https://github.com/libertydragonn/antigravity-zh-tw-plugin/releases/latest) 上的 zip 已內建 `runtime\`，解壓即用，並附 `.sha256` 校驗檔。

外掛包結構（解壓即用）：

```text
Antigravity中文化外掛-v1.8.0/
├── 安裝中文化外掛.bat          ← 雙擊這個
├── 還原官方原版.bat
├── 中文化並啟動.bat            ← 客戶端更新後雙擊這個
├── 建立桌面捷徑.bat
├── 註冊開機自動修復.bat
├── 取消開機自動修復.bat
├── 安裝上下文看板.bat          ← 加裝對話上下文 / Token 用量看板
├── 移除上下文看板.bat
├── install-macos.sh / launch-macos.sh / restore-macos.sh
├── 使用說明.txt
├── install.py / asar.py
├── context-viewer/            ← 上下文看板（elviscjn-cjn/antigravity-context-viewer v0.9.3）
├── dicts/
├── docs/
├── tools/
└── runtime/                  ← 免安裝 Python，使用者機器無需任何環境
```

存放庫結構：

```text
antigravity-zh-tw-plugin/
├── 安裝中文化外掛.bat          # 一鍵安裝
├── 還原官方原版.bat            # 一鍵還原
├── 中文化並啟動.bat            # 中文化並啟動（客戶端更新後恢復）
├── 建立桌面捷徑.bat            # 建立桌面捷徑
├── 註冊開機自動修復.bat        # 註冊開機自動修復
├── 取消開機自動修復.bat        # 取消開機自動修復
├── 安裝上下文看板.bat          # 加裝對話上下文檢視器與 Token 用量看板
├── 移除上下文看板.bat          # 移除看板（保留中文化）
├── install-macos.sh          # macOS / Linux 一鍵安裝
├── launch-macos.sh           # macOS / Linux 中文化並啟動（更新後恢復）
├── restore-macos.sh          # macOS / Linux 一鍵還原
├── install.py                # 安裝器：注入 / 還原 / 狀態 / 冒煙測試 / 開機自動修復
├── asar.py                   # 純 Python asar 解包與打包
├── VERSION                   # 版本號
├── 使用說明.txt
├── context-viewer/            # 上下文看板（上游 v0.9.3 執行檔案 + 繁體相容修補，勿手動修改）
├── dicts/
│   ├── zh_tw.json            # 整句詞典（繁體中文）
│   └── engine.js             # DOM 翻譯引擎模板（含動態規則）
├── docs/
│   ├── HOW_IT_WORKS.md       # 翻譯機制詳解（進階閱讀）
│   └── PROMPT.md             # 專案復現提示詞（交給 AI 從零重做）
├── tools/
│   ├── s2tw_convert.py       # 簡體版 → 繁體版轉換工具
│   ├── vendor_context_viewer.py  # 從上游看板更新 context-viewer/ 並套用繁體相容修補
│   └── viewer_panel_lang.js  # 安裝時把看板面板語言設為繁體中文（不覆蓋使用者的選擇）
├── runtime/                  # Windows 免安裝 Python 執行環境（不進 Git，Release 包內建）
├── README.md
└── LICENSE                   # MIT
```

### 跟進上游簡體版更新

上游發布新版後，下載並解壓其外掛包，再執行：

```bat
pip install opencc
python tools\s2tw_convert.py "Antigravity汉化插件-vX.Y.Z" "Antigravity中文化外掛-vX.Y.Z"
```

轉換規則（臺灣用語修正表、詞典鍵不轉換、程式碼骨架比對）寫在指令碼開頭。轉換完成後請用 `git diff` 比對，保留本版對 `install.py`（從簡體版升級時更新載入畫面提示、上下文看板整合）與 README 的手動修改。

### 跟進上游看板更新

```bat
git clone https://github.com/elviscjn-cjn/antigravity-context-viewer.git ..ntigravity-context-viewer
python toolsendor_context_viewer.py ..ntigravity-context-viewer
```

指令碼會依上游發布清單複製執行檔案到 `context-viewer/`，並套用繁體相容修補；任一修補比對次數不符就中止（代表上游程式碼已變動，需要重新檢查定位標籤）。

---

## 免責宣告

本專案與 Google 及 Antigravity 官方團隊無關，不包含 Antigravity 任何二進位內容。
內建的上下文看板來自 [elviscjn-cjn/antigravity-context-viewer](https://github.com/elviscjn-cjn/antigravity-context-viewer)（MIT，作者 ELVISCHEN 與貢獻者，授權與第三方聲明見 `context-viewer/LICENSE`、`context-viewer/THIRD_PARTY_NOTICES.md`）。
修改 `app.asar` 可能違反官方服務條款，請自行評估使用風險。

## License

[MIT](LICENSE)；`context-viewer/` 依其 [MIT 授權](context-viewer/LICENSE)。

