(function() {
  const dictionary = {
    "Allow": "允許",
    "Deny": "拒絕",
    "Reason": "申請原因",
    "Run Command": "執行命令",
    "Run command": "執行命令",
    "Terminal Command": "終端機命令",
    "CommandLine": "命令列",
    "Command Line": "命令列",
    "Execute": "執行",
    "Approved": "已批准",
    "Pending approval": "等待批准",
    "Task ID": "任務 ID",
    "Working Directory": "工作目錄",
    "Cancel": "取消",
    "Close": "關閉",
    "Confirm": "確認",
    "Submit": "提交",
    "Skip": "跳過",
    "Requesting permission": "正在請求權限",
    "Insufficient permissions": "權限不足",
    "Permission requested": "已請求權限",
    "Target": "目標",
    "Action": "操作",
    "Grant Permission": "授予權限",
    "Deny Permission": "拒絕權限",
    "Always Allow": "總是允許",
    "Always Deny": "總是拒絕",
    "Always allow for this session": "在此會話中始終允許",
    "Always deny for this session": "在此會話中始終拒絕",
    "Run in background": "背景執行",
    "Keep running in background": "保持背景執行",
    "Execution output": "執行輸出",
    "Error executing command": "執行命令時出錯",
    "Command completed successfully": "命令執行成功",
    "The command failed with exit code": "命令執行失敗，退出程式碼為",
    "WaitMsBeforeAsync": "非同步等待時間（毫秒）",
    "This command is running asynchronously in the background.": "該命令正在背景非同步執行。",
    "View logs": "檢視日誌",
    "Clear logs": "清除日誌",
    "Kill task": "終止任務",
    "Command history": "命令歷史記錄",
    "Operating System": "作業系統",
    "Shell": "終端機 Shell",
    "The actual command will NOT execute until you approve it": "在您批准之前，該命令不會實際執行",
    "This tool is proposing to run a command on your behalf": "此工具申請代表您執行以下命令",
    "Ask Permission": "請求授權",
    "File": "檔案",
    "Edit": "編輯",
    "View": "檢視",
    "Selection": "選擇",
    "Find": "尋找",
    "Help": "幫助",
    "Docs": "文件",
    "Docs & API Reference": "文件與 API 參考",
    "Toggle Developer Tools": "開發者工具",
    "New Window": "新視窗",
    "Quit": "退出",
    "Confirm Quit": "確認退出",
    "Are you sure you want to quit?": "您確定要退出嗎？",
    "There may be agents or background tasks running.": "可能還有代理程式或背景任務正在執行。",
    "Welcome to the new Antigravity!": "歡迎使用全新 Antigravity！",
    "Antigravity has been redesigned to put agents first with new capabilities. If you'd still like a code editor, you can download it as a separate app named": "Antigravity 已經重構為以代理程式為核心的全新平臺。如果您仍需要程式碼編輯器，可以將其作為名為以下的獨立應用下載：",
    "Antigravity IDE": "Antigravity IDE 編輯器",
    "Download the Antigravity IDE": "下載 Antigravity IDE",
    "Explore the new Antigravity": "探索全新 Antigravity",
    "Setting up…": "正在設定...",
    "Agent": "代理程式",
    "Agents": "代理程式",
    "Subagent": "子代理程式",
    "Subagents": "子代理程式",
    "Task": "任務",
    "Tasks": "任務",
    "Workspace": "工作區",
    "Workspaces": "工作區",
    "Command": "命令",
    "Run": "執行",
    "Settings": "設定",
    "Model": "模型",
    "Stop": "停止",
    "Approve": "批准",
    "Reject": "拒絕",
    "Terminal": "終端機",
    "Output": "輸出",
    "Codebase": "程式碼庫",
    "Error": "錯誤",
    "Success": "成功",
    "Pending": "等待中",
    "Running": "執行中",
    "Completed": "已完成",
    "Failed": "已失敗",
    "Branch": "分支",
    "Merge": "合併",
    "Conflict": "衝突",
    "Generate Image": "生成影像",
    "Web Search": "網頁搜尋",
    "Grep Search": "全域性搜尋",
    "Active Agents": "活躍代理程式",
    "No agents running": "沒有執行中的代理程式",
    "active workspace": "活動工作區",
    "Active Workspace": "活動工作區",
    "Search": "搜尋",
    "Search...": "搜尋...",
    "Type a command...": "輸入命令...",
    "Settings & Preferences": "設定與偏好",
    "General": "通用",
    "Themes": "主題",
    "Language": "語言",
    "Model Selection": "模型選擇",
    "Advanced": "進階",
    "Developer": "開發者",
    "Save": "儲存",
    "Status": "狀態",
    "Progress": "進度",
    "Logs": "日誌",
    "Console": "控制台",
    "Running task...": "任務執行中...",
    "Task completed successfully": "任務成功完成",
    "An error occurred": "發生錯誤",
    "Connecting to Language Server...": "正在連線語言伺服器...",
    "Language Server": "語言伺服器",
    "Connected": "已連線",
    "Disconnected": "已斷開",
    "Select a folder": "選擇資料夾",
    "Open Folder": "開啟資料夾",
    "Create New Project": "建立新專案",
    "Antigravity": "Antigravity",
    "Antigravity 2.0": "Antigravity 2.0",
    "Google DeepMind": "Google DeepMind",
    "Advanced Agentic Coding": "進階代理程式編碼",
    "Welcome to Antigravity": "歡迎使用 Antigravity",
    "Get Started": "開始使用",
    "Create an agent to get started": "建立一個代理程式以開始",
    "New Agent": "新建代理程式",
    "Agent Name": "代理程式名稱",
    "System Prompt": "系統提示詞",
    "Description": "描述",
    "Capabilities": "能力",
    "Write Files": "寫入檔案",
    "Run Commands": "執行命令",
    "Web Browsing": "網頁瀏覽",
    "Define Subagents": "定義子代理程式",
    "Call MCP Tools": "呼叫 MCP 工具",
    "Inherit Workspace": "繼承工作區",
    "Branch Workspace": "分支隔離工作區",
    "Share Workspace": "共享工作區",
    "timer": "定時器",
    "Timers": "定時器",
    "Cron Jobs": "計劃任務",
    "Schedule": "排程",
    "Directory analysis": "目錄分析",
    "Web search": "網頁搜尋",
    "File edit": "檔案編輯",
    "Command execution": "命令執行",
    "Semantic search": "語義搜尋",
    "Permissions": "權限",
    "Configure global allowed and denied resource permissions. Learn more.": "配置全域性允許與拒絕的資源存取權限。瞭解更多。",
    "Configure global allowed and denied resource permissions.": "配置全域性允許與拒絕的資源存取權限。",
    "Learn more.": "瞭解更多。",
    "Learn more": "瞭解更多",
    "Project-Specific Settings": "專案專屬設定",
    "Project-Specific": "專案專屬",
    "Modify scoped permissions, folders, and Agent settings like Sandbox and Terminal command execution.": "修改專案專屬存取權限、工作資料夾以及代理程式設定（例如沙箱和終端機命令執行）。",
    "Modify scoped permissions, folders, and Agent settings": "修改專案專屬存取權限、工作資料夾以及代理程式設定",
    "like Sandbox and Terminal command execution.": "例如沙箱與終端機命令執行。",
    "Go to Projects": "轉到專案",
    "File Permissions": "檔案權限",
    "File Access Rules": "檔案存取規則",
    "Configure allowed and denied paths for file reads and writes.": "配置檔案讀寫的允許與拒絕路徑。",
    "Network Permissions": "網路權限",
    "Network Access Rules": "網路存取規則",
    "Configure allowed and denied URLs for reading.": "配置允許或禁止讀取的 URL。",
    "Terminal & Tooling Permissions": "終端機和工具權限",
    "Terminal Commands": "終端機命令",
    "Configure allowed terminal commands.": "配置允許執行的終端機命令。",
    "Commands Outside Sandbox": "沙箱外命令",
    "Configure allowed commands outside the sandbox.": "配置允許在沙箱外執行的終端機命令。",
    "MCP Tools": "MCP 工具",
    "Configure external tools via Model Context Protocol.": "透過模型上下文協議 (MCP) 配置外部工具。",
    "Global": "全域性",
    "Sandbox": "沙箱",
    "Sandbox enabled": "沙箱已啟用",
    "Sandbox disabled": "沙箱已停用",
    "Allowed": "已允許",
    "Denied": "已拒絕",
    "Paths": "路徑",
    "URLs": "URL",
    "Tools": "工具",
    "Appearance": "外觀",
    "Configure the Agent's visual theme and display preferences.": "配置代理程式的視覺主題與顯示偏好。",
    "Chat Settings": "對話設定",
    "Verbose Agent Chat": "顯示代理程式詳細輸出",
    "Display and preserve intermediate thinking steps": "顯示並保留代理程式中間思考過程",
    "Choose light, dark, or inherit system settings.": "選擇淺色、深色，或繼承系統設定。",
    "Dark": "深色",
    "Light": "淺色",
    "Light Theme": "淺色主題",
    "Preset": "預設",
    "Default Light": "預設淺色",
    "Background": "背景色",
    "Foreground": "前景色",
    "Accent": "強調色",
    "Dark Theme": "深色主題",
    "Default Dark": "預設深色",
    "Customizations": "自訂",
    "Configure default behaviors, skills, and MCP servers.": "配置預設行為、技能以及 MCP 伺服器。",
    "Token Usage": "Token 用量",
    "The breakdown below shows token usage from customizations like skills, rules, and MCP. If the budget is exceeded, large customizations will be truncated automatically.": "以下詳情展示了來自技能、規則和 MCP 等自訂擴充功能的 Token 使用情況。如果額度超限，大型自訂內容將被自動截斷。",
    "of the customization budget is available.": "的自訂額度可用。",
    "100.0% of the customization budget is available.": "100.0% 的自訂額度可用。",
    "No customizations found for this workspace.": "未找到此工作區的自訂擴充功能。",
    "Installed MCP Servers": "已安裝的 MCP 伺服器",
    "No MCP Servers": "無已安裝的 MCP 伺服器",
    "You currently don't have any MCP Servers installed.": "您當前未安裝任何 MCP 伺服器。",
    "Add an MCP server above": "在上方新增一個 MCP 伺服器",
    "Build With Google Plugins": "使用 Google 外掛建構",
    "Account": "帳號",
    "Manage your plan, credentials, and general preferences.": "管理您的套餐、憑據與常規偏好。",
    "Enable Telemetry": "啟用遙測",
    "When toggled on, Antigravity collects usage data to help Google enhance performance and features.": "開啟後，Antigravity 會收集使用資料，以幫助 Google 持續改進效能和功能。",
    "Marketing Emails": "營銷電子郵件",
    "Receive product updates, tips, and promotions from Google Antigravity via email.": "透過電子郵件接收來自 Google Antigravity 的產品更新、技巧與促銷資訊。",
    "Your Plan:": "您的套餐：",
    "Your Plan: Google AI Pro": "您的套餐：Google AI Pro",
    "You can upgrade to a Google AI Ultra plan to receive the highest rate limits.": "您可以升級到 Google AI Ultra 套餐，獲得最高的使用限額。",
    "Email": "電子郵件",
    "Browser Settings": "瀏覽器設定",
    "Configure the browser subagent. It requires Google Chrome to be installed. The browser subagent can be invoked by typing /browser in the conversation input box.": "配置瀏覽器子代理程式。這需要安裝 Google Chrome。可以在對話輸入框中輸入 /browser 來呼叫瀏覽器子代理程式。",
    "Configure the browser subagent. It requires Google Chrome to be installed. The browser subagent can be invoked by typing": "配置瀏覽器子代理程式。這需要安裝 Google Chrome。可以透過輸入",
    "in the conversation input box.": "在對話輸入框中呼叫該子代理程式。",
    "Browser Javascript Execution Policy": "瀏覽器 JavaScript 執行策略",
    "Controls whether the agent can run custom JavaScript to automate complex browser actions.": "控制代理程式是否可以執行自訂 JavaScript 以自動化複雜的瀏覽器操作。",
    "Request Review": "請求審查",
    "Disabled": "已停用",
    "Block all browser JavaScript execution.": "阻止所有瀏覽器 JavaScript 執行。",
    "Prompt for approval before running browser scripts.": "執行瀏覽器指令碼前請求批准。",
    "Allow full browser script execution without prompting.": "允許完整瀏覽器指令碼執行，無需提示。",
    "Actuation Permissions": "動作執行權限",
    "Browser Actuation Rules": "瀏覽器操作控制規則",
    "Configure allowed and denied URLs for browser actuation.": "配置允許或禁止瀏覽器執行動作的 URL 列表。",
    "App Settings": "應用設定",
    "Prevent Sleep": "防止電腦休眠",
    "Prevent the computer from sleeping while the app is running.": "在應用執行時防止電腦進入休眠狀態。",
    "Keep In Menu Bar": "常駐系統系統匣",
    "The app will be accessible from the menu bar and will keep running in the background when all windows are closed.": "關閉所有視窗後，應用將常駐選單欄並在背景保持執行。",
    "Notifications": "通知",
    "Notification Settings": "通知設定",
    "To modify notification settings, open your operating system's system preferences.": "如需修改通知設定，請開啟您作業系統的系統偏好設定。",
    "Agent Settings": "代理程式設定",
    "Security Preset": "安全預設",
    "Choose a predefined security preset for the agent. This controls terminal auto-execution policy, and file access policy.": "為代理程式選擇預定義的安全預設。這將控制終端機自動執行策略和檔案存取策略。",
    "Choose a predefined security preset for the agent.": "為代理程式選擇預定義的安全預設。",
    "This controls terminal auto-execution policy, and file access policy.": "這將控制終端機自動執行策略和檔案存取策略。",
    "Learn more about Default": "瞭解關於預設預設的更多資訊",
    "Default": "預設",
    "Agent Behavior": "代理程式行為",
    "Artifact Review Policy": "工件審查策略",
    "Specifies agent's behavior when asking for review on artifacts, which are documents it creates to enable a richer conversation experience.": "指定代理程式在請求審查工件時的行為。工件是其為提供更豐富的對話體驗而建立的文件。",
    "Always Ask": "始終詢問",
    "Local Permissions": "專案專屬權限",
    "Inherits from global settings. Local permissions have higher priority.": "繼承自全域性設定。專案專屬權限具有更高的優先順序。",
    "Inherits from global settings.": "繼承自全域性設定。",
    "Local permissions have higher priority.": "專案專屬權限具有更高的優先順序。",
    "Danger Zone": "危險區域",
    "Delete Project": "刪除專案",
    "Permanently delete this project and all of its conversations.": "永久刪除當前專案及其包含的所有歷史對話。",
    "Custom": "自訂",
    "Outside of folders file access policy": "資料夾外檔案存取策略",
    "Configures how the agent tries to access files outside of its working folders.": "配置代理程式如何嘗試存取其工作資料夾外部的檔案。",
    "Terminal command Auto execution": "終端機命令自動執行",
    "Controls whether terminal commands require your approval before running.": "控制終端機命令在執行前是否需要您批准。",
    "Require Review": "需要審查",
    "Add Context": "新增上下文",
    "Media": "媒體",
    "Mentions": "提及",
    "Actions": "操作",
    "Browser": "瀏覽器",
    "Worktree": "工作樹",
    "Projects": "專案",
    "Review Changes": "審查更改",
    "Ask anything, @ to mention, / for actions": "輸入任何問題，輸入 @ 提及，/ 觸發操作",
    "Ask anything, @to mention, /for actions": "輸入任何問題，輸入 @ 提及，/ 觸發操作",
    "Ask anything, @ to mention, / for commands": "輸入任何問題，輸入 @ 提及，/ 觸發命令",
    "Ask anything, @to mention, /for commands": "輸入任何問題，輸入 @ 提及，/ 觸發命令",
    "Overview": "概覽",
    "Artifacts": "工件",
    "Conversations": "對話",
    "Agent settings and permissions for conversations outside of projects.": "專案外部對話的代理程式設定和權限配置。",
    "Not in Project": "不在專案中",
    "Manage project folders, agent settings, and permissions.": "管理專案資料夾、代理程式設定和專屬權限。",
    "Requires manual review for all terminal commands and file accesses outside of the working folders.": "執行終端機命令以及存取工作區外的檔案時，均需手動人工審查。",
    "Full Machine": "完整本機存取",
    "All terminal commands require review. The agent can read or write to any file in the machine.": "所有終端機命令均需審查，代理程式可讀寫本機上的任意檔案。",
    "Unrestricted": "無限制模式",
    "Disables all safety barriers for maximal iteration velocity.": "停用所有安全屏障以獲得極致的迭代效率。",
    "Manually customize individual settings.": "手動自訂各項具體設定。",
    "Always Proceed": "始終繼續",
    "One Light": "One 淺色",
    "Solarized Light": "Solarized 淺色",
    "One Dark Pro": "One 深色 Pro",
    "Configure AI models and view your quota.": "配置 AI 模型並檢視您的配額。",
    "Refresh": "重新整理",
    "Model Credits": "模型額度",
    "Enable AI Credit Overages": "啟用 AI 額度超量使用",
    "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.": "開啟後，當您的模型配額耗盡時，Antigravity 將使用您的 AI 額度來滿足模型請求。Antigravity 始終會先使用您的模型配額，然後再使用 AI 額度。",
    "Model Quota": "模型配額",
    "View your available model quota and AI credits. Model quota refreshes periodically based on your plan. Enable AI Credit Overages to continue using models when your quota is exhausted.": "檢視您可用的模型配額和 AI 額度。模型配額會根據您的套餐定期重新整理。啟用 AI 額度超量使用，以便在配額耗盡時繼續使用模型。",
    "Shortcuts": "快捷鍵",
    "Keyboard shortcuts for quick navigation and control.": "用於快速導航與控制的鍵盤快捷鍵。",
    "Recommended": "推薦",
    "Open Conversation Picker": "開啟對話選擇器",
    "Open File Search": "開啟檔案搜尋",
    "Focus Input": "聚焦輸入框",
    "New Conversation": "新建對話",
    "Navigation": "導航",
    "Go Back": "後退",
    "Go Forward": "前進",
    "File Picker": "檔案選擇器",
    "Scheduled Tasks": "計劃任務",
    "Select Previous Conversation": "選擇上一個對話",
    "Select Next Conversation": "選擇下一個對話",
    "Open Settings": "開啟設定",
    "Conversation": "對話",
    "Conversation History": "歷史對話",
    "Conversation history": "歷史對話",
    "Toggle Model Selector": "切換模型選擇器",
    "Toggle Voice Recording": "切換錄音",
    "Find in Pane": "在窗格中尋找",
    "Layout Controls": "佈局控制",
    "Toggle Sidebar": "切換側邊欄",
    "Toggle Auxiliary Pane": "切換輔助窗格",
    "Zoom In": "放大",
    "Zoom Out": "縮小",
    "Reset Zoom": "重置縮放",
    "Provide Feedback": "提供反饋",
    "Feedback Type": "反饋型別",
    "Bug Report": "Bug 報告",
    "Feature Request": "功能請求",
    "Auth and Billing": "帳號與計費",
    "General Feedback": "常規反饋",
    "Please describe the feature you'd like to see. The more detailed the requirements, the easier it will be for our team to incorporate your ideas. Some helpful information includes:": "請描述您希望獲得的新功能。需求描述越詳盡，我們的團隊就越容易採納您的想法。以下是一些建議提供的資訊：",
    "What is missing in your workflow": "您的工作流中缺少了什麼",
    "What you would like to see to address this gap in your workflow": "您希望透過什麼功能來解決這一需求",
    "How this feature would help you and other users": "此功能如何幫助您和其他使用者",
    "Describe the feature you would like to see...": "請描述您希望獲得的新功能...",
    "Attach a screenshot (optional)": "新增螢幕截圖（可選）",
    "Attach Antigravity server logs": "附帶 Antigravity 伺服器日誌",
    "Send feedback as": "傳送反饋身份",
    "We recommend attaching logs. Attaching logs will help the Antigravity team act on and prioritize your feedback.": "我們建議附帶日誌。這將有助於 Antigravity 團隊更快速、更有針對性地處理您的問題。",
    "Checking for Updates...": "正在檢查更新...",
    "Downloading Update...": "正在下載更新...",
    "Restart to Update": "重啟以應用更新",
    "Check for Updates": "檢查更新",
    "No updates available": "當前已是最新版本",
    "Update available": "發現新版本",
    "Downloading...": "正在下載...",
    "Update downloaded": "更新已下載完成",
    "Error checking for updates": "檢查更新失敗",
    "Conversations": "對話",
    "Extra High": "超高",
    "XHigh": "超高",
    "Minimal": "極低",
    "Medium": "中等",
    "Max": "最高",
    "Orchestrator": "編排器",
    "Notice": "提示",
    "New": "新",
    "Fast": "快速",
    "Mark Read": "標為已讀",
    "Mark Unread": "標為未讀"
  };

  const coreWords = {
    "create": "建立", "delete": "刪除", "edit": "編輯", "save": "儲存", "cancel": "取消", "confirm": "確認",
    "close": "關閉", "open": "開啟", "stop": "停止", "start": "啟動", "run": "執行", "add": "新增", "remove": "移除",
    "update": "更新", "select": "選擇", "clear": "清除", "search": "搜尋", "find": "尋找", "view": "檢視", "show": "顯示", "hide": "隱藏",
    "agent": "代理程式", "agents": "代理程式", "subagent": "子代理程式", "subagents": "子代理程式", "task": "任務", "tasks": "任務",
    "workspace": "工作區", "workspaces": "工作區", "directory": "目錄", "folder": "資料夾", "file": "檔案", "files": "檔案",
    "command": "命令", "commands": "命令", "terminal": "終端機", "console": "控制台", "output": "輸出", "input": "輸入",
    "log": "日誌", "logs": "日誌", "setting": "設定", "settings": "設定", "preference": "偏好", "preferences": "偏好",
    "theme": "主題", "themes": "主題", "model": "模型", "models": "模型", "capability": "能力", "capabilities": "能力",
    "running": "執行中", "completed": "已完成", "failed": "已失敗", "pending": "等待中", "success": "成功", "error": "錯誤",
    "system": "系統", "prompt": "提示詞", "instructions": "指令", "description": "描述", "name": "名稱", "version": "版本",
    "active": "活躍", "background": "背景", "parent": "父級", "child": "子級", "branch": "分支", "share": "共享", "inherit": "繼承",
    "original": "原始", "backup": "備份", "duration": "持續時間", "seconds": "秒", "timer": "定時器", "timers": "定時器",
    "schedule": "排程", "cron": "定時任務", "tools": "工具", "tool": "工具", "execute": "執行", "execution": "執行", "plan": "計劃",
    "chat": "聊天", "message": "訊息", "messages": "訊息", "history": "歷史", "clear history": "清除歷史",
    "changed": "已更改", "review": "審查", "reviewing": "審查中", "reviewed": "已審查",
    "edited": "編輯了", "canceled": "已取消",
    "explore": "探索", "change": "更改", "changes": "更改",
    "turn": "回合", "turns": "回合"
  };


  

  __DICT_ITEMS__
  // 將 extraDict 合併到 dictionary（從零注入時必需）
  if (typeof extraDict !== 'undefined') {
    for (const ek in extraDict) {
      if (!(ek in dictionary) && !(ek in coreWords)) dictionary[ek] = extraDict[ek];
    }
  }
  // ===== 索引與快取（v5 效能最佳化 + 防誤拼）=====
  // lowerLookup: 小寫 key -> 譯文（O(1) 精確匹配）
  // tokenLookup: 單個單詞 key -> 譯文（短文本逐詞兜底，過濾功能詞與長譯文）
  const TOKEN_BLOCKLIST = new Set([
    'new', 'no', 'yes', 'from', 'to', 'in', 'on', 'at', 'of', 'for', 'by', 'with',
    'as', 'or', 'and', 'the', 'a', 'an', 'is', 'are', 'be', 'not', 'tab', 'last',
    'next', 'back', 'app', 'system', 'notice', 'extra', 'max', 'low', 'high', 'medium',
    'pin', 'split', 'run', 'runs', 'plan', 'code', 'read', 'see', 'this', 'you', 'all',
    'end', 'eye', 'pro', 'flash', 'lite', 'fast', 'copy', 'move', 'show', 'hide'
  ]);
  let combinedDict, exactLookup, lowerLookup, tokenLookup;
  const translationCache = new Map();
  const CACHE_LIMIT = 8000;
  const CACHE_MAX_TEXT = 900;

  function rebuildDict() {
    combinedDict = Object.assign({}, coreWords, dictionary);
    exactLookup = new Map();
    lowerLookup = new Map();
    tokenLookup = new Map();
    for (const k in combinedDict) {
      const v = combinedDict[k];
      exactLookup.set(k, v);
      const lk = k.toLowerCase();
      if (!lowerLookup.has(lk)) lowerLookup.set(lk, v);
      const hanCount = (v.match(/[\u4e00-\u9fff]/g) || []).length;
      if (!/\s/.test(k) && !TOKEN_BLOCKLIST.has(lk) && !/[\s/()（）]/.test(v) && hanCount <= 4 && !tokenLookup.has(lk)) {
        tokenLookup.set(lk, v);
      }
    }
    translationCache.clear();
  }
  rebuildDict();

  function loadExternalDict() {
    try {
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      const extPath = path.join(os.homedir(), '.antigravity-zh', 'zh-TW.json');
      if (!fs.existsSync(extPath)) return;
      const raw = fs.readFileSync(extPath, 'utf-8');
      const ext = JSON.parse(raw);
      const items = ext.translations || ext;
      let added = 0;
      for (const k in items) {
        if (k.startsWith('__')) continue;
        dictionary[k] = items[k]; // 外部詞典覆蓋嵌入詞典
        added++;
      }
      if (added > 0) {
        rebuildDict();
        console.log('[Antigravity-ZH] 外部詞典已載入 ' + added + ' 條，總計 ' + Object.keys(dictionary).length + ' 條');
        // 清快取後重新排隊翻譯當前頁面（不阻塞主執行緒）
        setTimeout(function () {
          if (document.body && typeof enqueueNode === 'function') enqueueNode(document.body, true);
        }, 0);
      }
    } catch (e) {
      // sandbox 或權限不足時靜默失敗，用嵌入詞典
    }
  }

  // 監聽外部詞典檔案變化，熱重載
  try {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const extPath = path.join(os.homedir(), '.antigravity-zh', 'zh-TW.json');
    if (fs.existsSync(extPath)) {
      fs.watch(extPath, { persistent: false }, function () {
        setTimeout(loadExternalDict, 200); // 防抖：等檔案寫入完成
      });
    }
  } catch (e) {}

  const escapeRegExp = (str) => {
    const specials = ['[', ']', '(', ')', '{', '}', '*', '+', '?', '.', '^', '$', '|', '\\'];
    return str.split('').map(c => specials.includes(c) ? '\\' + c : c).join('');
  };

  // 時長格式化：1d2h3m4.5s / 1d 2h 3m -> 1 天 2 小時 3 分 4.5 秒
  const fmtDuration = function (d) {
    return d
      .replace(/(\d+(?:\.\d+)?)\s*d/gi, '$1 天')
      .replace(/(\d+(?:\.\d+)?)\s*h/gi, '$1 小時')
      .replace(/(\d+(?:\.\d+)?)\s*m/gi, '$1 分')
      .replace(/(\d+(?:\.\d+)?)\s*s/gi, '$1 秒')
      .replace(/(天|小時|分|秒)\s*(?=\d)/g, '$1 ');
  };
  const MONTH_CN = { jan: '1月', feb: '2月', mar: '3月', apr: '4月', may: '5月', jun: '6月', jul: '7月', aug: '8月', sep: '9月', oct: '10月', nov: '11月', dec: '12月' };
  const meridiem = function (ap) { return ap.toUpperCase() === 'PM' ? '下午' : '上午'; };
  const EFFORT_CN = {
    minimal: '極低',
    low: '低',
    medium: '中等',
    high: '高',
    'extra high': '超高',
    xhigh: '超高',
    extra: '超高',
    max: '最高'
  };
  function translateEffort(e) {
    if (!e) return e;
    return EFFORT_CN[String(e).trim().toLowerCase()] || e;
  }
  // 動態正則規則（參考社群中文化專案沉澱，整串錨定匹配；在詞典精確匹配之後執行）
  const dynamicRules = [
    // --- v2.34 模型推理強度與編排器組合 ---
    [/^((?:Gemini|Claude|GPT|Orchestrator)[^\n(]{1,60}?)\s*\((Extra High|XHigh|Extra|Minimal|Low|Medium|High|Max)(?:\s+thinking)?\)$/i, function (m, model, effort) {
      return translateCaptured(model.trim()) + ' (' + translateEffort(effort) + ')';
    }],
    [/^((?:Gemini|Claude|GPT)[^\n·]{1,60}?)\s+(Extra High|XHigh|Extra|Minimal|Low|Medium|High|Max)(\s*·\s*.+)?$/i, function (m, model, effort, tail) {
      return model.trim() + ' ' + translateEffort(effort) + (tail || '');
    }],
    [/^(Extra High|XHigh|Minimal|Low|Medium|High|Max|Extra)\s*·\s*(.+)$/i, function (m, effort, rest) {
      return translateEffort(effort) + ' · ' + rest;
    }],
    [/^Orchestrator\s+(.+)$/i, function (m, rest) {
      return '編排器 ' + translateString(rest.trim());
    }],
    // --- v2.34 全面適配規則（置於通用 Open/Remove/Toggle 規則之前）---
    [/^Pin Entire (.+)$/i, function (m, target) { return '置頂整個' + translateCaptured(target); }],
    [/^Unpin (.+)$/i, function (m, target) { return '取消置頂' + translateCaptured(target); }],
    [/^Move to Group:\s*(.+)$/i, '移動到分組：$1'],
    [/^Open Subagent:\s*(.+)$/i, '開啟子代理程式：$1'],
    [/^Open URL in system browser:\s*(.+)$/i, '在系統瀏覽器中開啟 URL：$1'],
    [/^Open the (.+) plugin$/i, '開啟 $1 外掛'],
    [/^Open (.+) skill$/i, '開啟 $1 技能'],
    [/^Show (.+) in folder$/i, '在資料夾中顯示 $1'],
    [/^Opens the New Conversation screen for this (.+)$/i, function (m, t) { return '開啟此' + translateCaptured(t) + '的「新建對話」頁面'; }],
    [/^Agents created by this (.+?) run in a dedicated (.+?) with its own permissions\.\s*You can change the permissions in the (.+?) settings page\.$/i, function (m, src, scope) {
      return '由此' + translateCaptured(src) + '建立的代理程式將在獨立的' + translateCaptured(scope) + '中執行並擁有專屬權限。您可以在該' + translateCaptured(scope) + '設定頁面中更改權限。';
    }],
    [/^(.+),\s*(\d+)\s+grants?$/i, function (m, lbl, n) { return translateCaptured(lbl) + '，' + n + ' 項授權'; }],
    [/^(Disable|Enable)\s+(.+?)\s+tool\s+for\s+(.+)$/i, function (m, act, tool, target) {
      return (act.toLowerCase() === 'disable' ? '停用' : '啟用') + ' ' + target + ' 的 ' + tool + ' 工具';
    }],
    [/^Reset (.+) to default$/i, function (m, name) { return '將 ' + translateCaptured(name) + ' 重置為預設'; }],
    [/^(\d+) lines? added,\s*(\d+) lines? removed$/i, '新增 $1 行，刪除 $2 行'],
    [/^Plan,\s*(\d+) of (\d+) steps? done$/i, '計劃，已完成 $1 / $2 步'],
    [/^Unfold lines (\d+)-(\d+)$/i, '展開第 $1-$2 行'],
    [/^Go to page (\d+)$/i, '跳轉到第 $1 頁'],
    [/^Go to slide (\d+)$/i, '跳轉到第 $1 張投影片'],
    [/^Go to turn (\d+) of (\d+)$/i, '跳轉到第 $1 / $2 輪'],
    [/^Page (\d+) failed to load$/i, '第 $1 頁載入失敗'],
    [/^Playback speed ([\d.]+)x$/i, '播放速度 $1x'],
    [/^Zoom (\d+)%,\s*reset to fit$/i, '縮放 $1%，點選重置為適應頁面'],
    [/^Scroll to:\s*(.+?)\s+on page\s+(\d+)$/i, '滾動到第 $2 頁的 $1'],
    [/^Detached at ([0-9a-f]+)$/i, '分離頭指標位於 $1'],
    [/^View Diff for (.+)$/i, '檢視 $1 的差異'],
    [/^Resume (\d+) comment drafts?$/i, '恢復 $1 條批註草稿'],
    [/^(.+?)\s+\(Remote\)$/i, '$1（遠端）'],
    [/^(.+?)\s+\(experimental\)$/i, function (m, lbl) { return translateCaptured(lbl) + '（實驗性）'; }],
    [/^(.+?)\s+\(Default\)$/i, function (m, lbl) { return translateCaptured(lbl) + '（預設）'; }],
    [/^System default \((.+)\)$/i, '系統預設（$1）'],
    [/^Switch environment \((.+)\)$/i, '切換環境（$1）'],
    [/^This window's agents,\s*files,\s*and terminals are on (.+)\.$/i, '此視窗中的代理程式、檔案和終端機均位於 $1。'],
    [/^SSH:\s*(.+)$/i, 'SSH：$1'],
    [/^Branch,\s*current:\s*(.+)$/i, '分支，當前：$1'],
    [/^Connected to (.+)$/i, '已連線到 $1'],
    [/^Couldn't connect to (.+)$/i, '無法連線到 $1'],
    [/^Connect to (.+)$/i, function (m, target) { return '連線到 ' + translateCaptured(target); }],
    [/^Connect (.+)$/i, function (m, target) { return '連線 ' + translateCaptured(target); }],
    [/^Switch to (.+)$/i, function (m, target) { return '切換到 ' + translateCaptured(target); }],
    [/^Sign in to (.+) remotely$/i, '遠端登入到 $1'],
    [/^Sign in to (.+)$/i, '登入到 $1'],
    [/^Delete cookies for (.+)$/i, '刪除 $1 的 Cookie'],
    [/^The browser blocked the download of (.+)$/i, '瀏覽器阻止了 $1 的下載'],
    [/^Blocked cross-origin subframe "(.+)"$/i, '已阻止跨域子框架「$1」'],
    [/^Blocked external popup navigation to "(.+)"$/i, '已阻止跳轉到外部彈窗「$1」'],
    [/^Blocked navigation to "(.+)"$/i, '已阻止導航到「$1」'],
    [/^Blocked popup to "(.+)"$/i, '已阻止彈窗跳轉到「$1」'],
    [/^Search Google for [“"](.+)[”"]$/i, '在 Google 中搜索「$1」'],
    [/^Microphone access for (.+?) was denied\.\s*Quit and reopen the app to be asked again\.$/i, '$1 的麥克風權限已被拒絕。請退出並重新開啟應用以再次請求授權。'],
    [/^Microphone blocked\.\s*Allow in (.+)\.$/i, '麥克風已阻止。請在 $1 中允許存取。'],
    [/^Account this MCP server uses:\s*(.+)$/i, '此 MCP 伺服器使用的帳號：$1'],
    [/^Configure (.+)$/i, '配置 $1'],
    [/^Plugins in (.+)$/i, function (m, name) { return translateCaptured(name) + ' 中的外掛'; }],
    [/^Review (.+) before installing$/i, '安裝前審查 $1'],
    [/^Filter skills and rules:\s*(.+)$/i, function (m, s) { return '篩選技能和規則：' + translateCaptured(s); }],
    [/^More options for (.+)$/i, '「$1」的更多選項'],
    [/^More for (.+)$/i, '更多：$1'],
    [/^Remove (.+) from Recent$/i, '從最近記錄中移除 $1'],
    [/^Remove (.+) from list$/i, '從列表中移除 $1'],
    [/^Remove context from (.+)$/i, '從 $1 中移除上下文'],
    [/^(.+),\s*showing (\d+) of (\d+)$/i, function (m, title, b, c) { return translateCaptured(title) + '，正顯示第 ' + b + ' / ' + c + ' 項'; }],
    [/^Stop (\d+) selected$/i, '停止已選中的 $1 項'],
    [/^Run (.+) now$/i, '立即執行 $1'],
    [/^Fix with Agent:\s*(.+)$/i, '使用代理程式修復：$1'],
    [/^Cancel (.+)$/i, function (m, x) { return '取消 ' + translateCaptured(x); }],
    [/^Close (.+)$/i, function (m, x) { return '關閉 ' + translateCaptured(x); }],
    [/^Created? automation "(.+)"\.?$/i, '已建立自動化任務「$1」。'],
    [/^Deleted "(.+)"\.?$/i, '已刪除「$1」。'],
    [/^Enabled "(.+)"\.?$/i, '已啟用「$1」。'],
    [/^Started "(.+)"\.?$/i, '已啟動「$1」。'],
    [/^Restarted "(.+)"\.?$/i, '已重啟「$1」。'],
    [/^Restart (.+)$/i, function (m, x) { return '重啟 ' + translateCaptured(x); }],
    [/^Failed to delete "(.+)"$/i, '刪除「$1」失敗'],
    [/^Failed to save "(.+)"$/i, '儲存「$1」失敗'],
    [/^Failed to start "(.+)"\.?$/i, '啟動「$1」失敗。'],
    [/^Failed to update "(.+)"$/i, '更新「$1」失敗'],
    [/^A file already exists at (.+)\.?$/i, '位置 $1 已存在同名檔案。'],
    [/^The folder [“"](.+)[”"] does not exist\.\s*Would you like to create it\?$/i, '資料夾「$1」不存在。是否建立該資料夾？'],
    [/^[“"](.+)[”"] isn[’']t a valid folder name\.$/i, '「$1」不是有效的資料夾名稱。'],
    [/^Can[’']t create this path\s*[—-]\s*[“"](.+)[”"] is a file,\s*not a folder\.$/i, '無法建立此路徑——「$1」是檔案，而不是資料夾。'],
    [/^Cannot add folder:\s*"(.+)" is not a valid folder location\.$/i, '無法新增資料夾：「$1」不是有效的資料夾位置。'],
    [/^Voice [Ss]peed,\s*(.+)$/i, '語速，$1'],
    [/^(\d+)% left$/i, '剩餘 $1%'],
    [/^(\d+) comments?$/i, '$1 條批註'],
    [/^\+(\d+) more$/i, '另有 $1 項'],
    [/^(\d+) results?$/i, '$1 條結果'],
    [/^Copied to clipboard$/i, '已複製到剪貼簿'],
    [/^script timed out after (\d+)ms$/i, '指令碼在 $1 毫秒後超時'],
    [/^Failed to save project(?: (permissions|settings|Google3 configuration))?:\s*(.+)$/i, function (m, kind, err) {
      var k = kind ? (kind.toLowerCase() === 'permissions' ? '權限' : kind.toLowerCase() === 'settings' ? '設定' : 'Google3 配置') : '';
      return '儲存專案' + k + '失敗：' + err;
    }],
    [/^Failed to (archive|delete|create) (.+)$/i, function (m, op, what) {
      var opMap = { archive: '歸檔', delete: '刪除', create: '建立' };
      return opMap[op.toLowerCase()] + translateCaptured(what) + '失敗';
    }],
    [/^Delete ([^!?,;:]{1,40})$/i, function (m, what) { return '刪除 ' + translateCaptured(what); }],
    [/^Enable ([^!?,;:]{1,40})$/i, function (m, what) { return '啟用 ' + translateCaptured(what); }],
    [/^Edit ([^!?,;:]{1,40})$/i, function (m, what) { return '編輯 ' + translateCaptured(what); }],
    [/^View ([^!?,;:]{1,40})$/i, function (m, what) { return '檢視 ' + translateCaptured(what); }],
    [/^Label for (.+)$/i, '$1 的標籤'],
    [/^(.+) color picker$/i, '$1 顏色選擇器'],
    [/^(.+) download progress$/i, '$1 下載進度'],
    [/^App view for (.+)$/i, '$1 的應用檢視'],
    [/^Help us improve (.+?)\.?$/i, '幫助我們改進 $1。'],
    [/^Manage (.+?) app settings\.?$/i, '管理 $1 應用設定。'],
    [/^(.+?)\s+Failed$/i, function (m, x) { return translateCaptured(x) + '失敗'; }],
    [/^(.+?)\s+failed$/i, function (m, x) { return translateCaptured(x) + '失敗'; }],
    [/^(\d+)\s*(?:seconds?|secs?)\s+ago$/i, '$1 秒前'],
    [/^(\d+)\s*(?:minutes?|mins?)\s+ago$/i, '$1 分鐘前'],
    [/^(\d+)\s*(?:hours?|hrs?)\s+ago$/i, '$1 小時前'],
    [/^(\d+)\s*days?\s+ago$/i, '$1 天前'],
    [/^(\d+)\s*weeks?\s+ago$/i, '$1 周前'],
    [/^(\d+)\s*months?\s+ago$/i, '$1 個月前'],
    [/^(\d+)\s*years?\s+ago$/i, '$1 年前'],
    [/^(\d+)[sS]\s+ago$/, '$1 秒前'],
    [/^(\d+)[mM]\s+ago$/, '$1 分鐘前'],
    [/^(\d+)[hH]\s+ago$/, '$1 小時前'],
    [/^(\d+)[dD]\s+ago$/, '$1 天前'],
    [/^\((\d+)\s+subagents?\)$/i, '($1 個子代理程式)'],
    [/^(\d+)\s+subagents?$/i, '$1 個子代理程式'],
    [/^(\d+)\s+active\s+subagents?$/i, '$1 個執行中的子代理程式'],
    [/^(\d+)\s+tasks?\s+running$/i, '$1 個執行中的任務'],
    [/^(\d+)\s+agents?\s+running$/i, '$1 個執行中的代理程式'],
    [/^(\d+)\s+active\s+conversations?$/i, '$1 個活躍對話'],
    [/^(\d+)\s+archived\s+conversations?$/i, '$1 個已歸檔對話'],
    [/^See all\s*\((\d+)\)$/i, '檢視全部 ($1)'],
    [/^See all\s+(\d+)$/i, '檢視全部 $1 項'],
    [/^Step (\d+) of (\d+)$/i, '第 $1 步（共 $2 步）'],
    [/^Task (\d+) running$/i, '正在執行任務 $1'],
    [/^Created (\d+) files?$/i, '已建立 $1 個檔案'],
    [/^Modified (\d+) files?$/i, '已修改 $1 個檔案'],
    [/^Ran (\d+) commands?$/i, '已執行 $1 個命令'],
    [/^Thinking for (\d+)s$/i, '已思考 $1 秒'],
    [/^Stopped after (\d+) steps?$/i, '已在 $1 步後停止'],
    [/^You have used some of your weekly limit,?\s*it will fully refresh in (.*?)\.?$/i, '您已消耗了部分每週額度，將在 $1後完全重置重新整理。'],
    [/^You have used some of your 5-?hour limit,?\s*it will fully refresh in (.*?)\.?$/i, '您已消耗了部分 5 小時額度，將在 $1後完全重置重新整理。'],
    [/^You have hit your 5-?hour limit,?\s*it will refresh in (.*?)\.?$/i, '您已達到 5 小時上限，將在 $1後重置重新整理。'],
    [/^You have hit your weekly limit,?\s*it will refresh in (.*?)\.?$/i, '您已達到每週上限，將在 $1後重置重新整理。'],
    [/^Your quota for this model is running low\.?$/i, '您在此模型上的剩餘配額即將耗盡。'],
    [/^Your quota for this model has run out\.?$/i, '您在此模型上的配額已耗盡。'],
    [/^Your plan's baseline quota will refresh on (.+?)\.?\s*You can upgrade to a Google AI Ultra plan to receive higher rate limits\.?$/i, '您的套餐基礎配額將於 $1重置重新整理。您可以升級至 Google AI Ultra 以取得更高的請求配額與速率上限。'],
    [/^Your plan's baseline quota will refresh on (.+?)\.?\s*To continue using this model now,?\s*enable AI Credit overages\.?$/i, '您的套餐基礎配額將於 $1重置重新整理。若要立即繼續使用此模型，請啟用 AI 額度超量使用。'],
    [/^Your plan's baseline quota will refresh on ([^.。]+)\.?$/i, '您的套餐基礎配額將於 $1重置重新整理。'],
    [/^(?:Model|Your) quota will refresh on ([^.。]+)\.?$/i, '您的模型配額將於 $1重置重新整理。'],
    [/^You need at least (\d+) AI Credits to send messages\.?$/i, '您至少需要 $1 個 AI 額度才能傳送訊息。'],
    [/^To continue using this model now,?\s*purchase more AI Credits\.?$/i, '若要立即繼續使用此模型，請購買更多 AI 額度。'],
    [/^To continue using this model now,?\s*enable AI Credit overages\.?$/i, '若要立即繼續使用此模型，請啟用 AI 額度超量使用。'],
    [/^To continue using (.+?) now,?\s*purchase more AI Credits\.?$/i, '若要立即繼續使用 $1，請購買更多 AI 額度。'],
    [/^To continue using (.+?) now,?\s*enable AI Credit overages\.?$/i, '若要立即繼續使用 $1，請啟用 AI 額度超量使用。'],
    [/^Available AI Credits:\s*(.+)$/i, '可用 AI 額度：$1'],
    [/^([\d,]+)\s*\/\s*([\d,]+)\s*tokens?\s*\(([\d.]+%)\)$/i, '$1 / $2 個 Token ($3)'],
    [/^\(([\d,]+)\s*tokens?\)\s*([\d.]+%)$/i, '($1 個 Token) $2'],
    [/^\(([\d,]+)\s*tokens?\)$/i, '($1 個 Token)'],
    [/^[Rr]esets? in (\d+)\s*(?:d|days?)[,\s]+(\d+)\s*(?:h|hours?)[,\s]+(\d+)\s*(?:m|mins?|minutes?)\.?$/, '$1 天 $2 小時 $3 分鐘後重置'],
    [/^[Rr]esets? in (\d+)\s*(?:d|days?)[,\s]+(\d+)\s*(?:h|hours?)\.?$/, '$1 天 $2 小時後重置'],
    [/^[Rr]esets? in (\d+)\s*(?:h|hours?)[,\s]+(\d+)\s*(?:m|mins?|minutes?)\.?$/, '$1 小時 $2 分鐘後重置'],
    [/^[Rr]esets? in (\d+)\s*(?:m|mins?|minutes?)[,\s]+(\d+)\s*(?:s|secs?|seconds?)\.?$/, '$1 分 $2 秒後重置'],
    [/^[Rr]esets? in (\d+)\s*(?:d|days?)\.?$/, '$1 天后重置'],
    [/^[Rr]esets? in (\d+)\s*(?:h|hours?)\.?$/, '$1 小時後重置'],
    [/^[Rr]esets? in (\d+)\s*(?:m|mins?|minutes?)\.?$/, '$1 分鐘後重置'],
    [/^[Rr]esets? in (\d+)\s*(?:s|secs?|seconds?)\.?$/, '$1 秒後重置'],
    [/^[Rr]esets? in less than a minute\.?$/i, '不到 1 分鐘後重置'],
    [/^[Rr]esets? in a few seconds\.?$/i, '幾秒後重置'],
    [/^[Rr]esets? soon\.?$/i, '即將重置'],
    [/^[Rr]efreshes? in (\d+)\s*(?:d|days?)[,\s]+(\d+)\s*(?:h|hours?)[,\s]+(\d+)\s*(?:m|mins?|minutes?)\.?$/, '$1 天 $2 小時 $3 分鐘後重置重新整理'],
    [/^[Rr]efreshes? in (\d+)\s*(?:d|days?)[,\s]+(\d+)\s*(?:h|hours?)\.?$/, '$1 天 $2 小時後重置重新整理'],
    [/^[Rr]efreshes? in (\d+)\s*(?:h|hours?)[,\s]+(\d+)\s*(?:m|mins?|minutes?)\.?$/, '$1 小時 $2 分鐘後重置重新整理'],
    [/^[Rr]efreshes? in (\d+)\s*(?:d|days?)\.?$/, '$1 天后重置重新整理'],
    [/^[Rr]efreshes? in (\d+)\s*(?:h|hours?)\.?$/, '$1 小時後重置重新整理'],
    [/^[Rr]efreshes? in (\d+)\s*(?:m|mins?|minutes?)\.?$/, '$1 分鐘後重置重新整理'],
    [/^[Rr]efreshes? in (\d+)\s*(?:s|secs?|seconds?)\.?$/, '$1 秒後重置重新整理'],
    [/^[Rr]efreshes? soon\.?$/i, '即將重置重新整理'],
    [/^Permanently delete (.+?)\s+including\s+(\d+)\s+active\s+conversations?\s*([?.。？])?$/i, function (m, body, n, p) { return '永久刪除 ' + body + '，包括其中的 ' + n + ' 個活躍對話' + (p === '?' ? '？' : p === '.' ? '。' : p || ''); }],
    [/^Permanently delete (.+?)\s*([?.。？])?$/, function (m, body, p) { return '永久刪除 ' + body + (p === '?' ? '？' : p === '.' ? '。' : p || ''); }],
    [/^Mark all (\d+) conversations as read$/i, '將全部 $1 個對話標記為已讀'],
    [/^Mark (\d+) conversations? as read$/i, '將 $1 個對話標記為已讀'],
    [/^You have (\d+) conversations in progress\. Updating will interrupt them, and they will automatically resume once the update completes\.$/i, '您當前有 $1 個正在進行的對話。更新將暫時中斷這些對話，並在更新完成後自動恢復。'],
    [/^You have (\d+) conversations in progress\. Updating will cancel them and you'll need to manually restart them\.$/i, '您當前有 $1 個正在進行的對話。更新將取消這些對話，更新後您需要手動重新開始。'],
    [/^(Enter|Alt\+Enter|Shift\+Enter|Ctrl\+Enter|Cmd\+Enter)\s+Queues after the turn$/i, '$1 在當前回合結束後排隊'],
    [/^(Enter|Alt\+Enter|Shift\+Enter|Ctrl\+Enter|Cmd\+Enter)\s+Sends immediately$/i, '$1 立即傳送'],
    [/^(Enter|Alt\+Enter|Shift\+Enter|Ctrl\+Enter|Cmd\+Enter)\s+On empty prompt,\s*sends next in queue$/i, '$1 在輸入框為空時傳送佇列中的下一條訊息'],
    [/^Record Audio(\s+Ctrl\+[A-Za-z])?$/i, '錄製語音$1'],
    [/^New Terminal(\s+Ctrl\+Shift\+.*)?$/i, '新建終端機$1'],
    [/^Add Terminal(\s+Ctrl\+Shift\+.*)?$/i, '新增終端機$1'],
    [/^Add Context(\s+.*)?$/i, '新增上下文$1'],
    // --- 外掛市場卡片按鈕 / 無障礙標籤 ---
    [/^Install ([^!?,;:]{1,40})$/i, function (m, name) { return '安裝 ' + translateCaptured(name); }],
    [/^Add ([^!?,;:]{1,30})$/i, function (m, name) { return '新增 ' + translateCaptured(name); }],
    [/^Details for (.+)$/i, function (m, name) { return translateCaptured(name) + ' 詳情'; }],
    [/^Select Project(\s+(?:Ctrl|Cmd|Alt|Shift)\+[\w;:,/+ -]+)?$/i, '選擇專案$1'],
    [/^Select Model(\s+(?:Ctrl|Cmd|Alt|Shift)\+[\w;:,/+ -]+)?$/i, '選擇模型$1'],
    [/^Cancel\s*\(((?:Ctrl|Cmd|Alt|Shift)\+[\w+-]+)\)$/i, '取消 ($1)'],
    // --- 快捷鍵設定頁動態標籤 ---
    [/^Recording shortcut for (.+)\. Press keys to bind, Enter to save, Escape to cancel\.$/i, function (m, action) { return '正在錄製「' + translateCaptured(action) + '」的快捷鍵。按下按鍵進行繫結，Enter 儲存，Escape 取消。'; }],
    [/^Remove shortcut\s+(.+?)\s+for\s+(.+)$/i, function (m, key, action) { return '移除「' + translateCaptured(action) + '」的快捷鍵 ' + key; }],
    [/^Add shortcut for\s+(.+)$/i, function (m, action) { return '為「' + translateCaptured(action) + '」新增快捷鍵'; }],
    [/^Shortcut\s+(.+?)\s+for\s+(.+)$/i, function (m, key, action) { return '「' + translateCaptured(action) + '」的快捷鍵：' + key; }],
    [/^Send [Mm]essage\s+(Enter|Return|Ctrl\+Enter|Cmd\+Enter|↵)$/, '傳送訊息 $1'],
    [/^Send [Mm]essage\s+\((Enter|Return|Ctrl\+Enter|Cmd\+Enter|↵)\)$/, '傳送訊息 ($1)'],
    // --- v2.31 新增介面 ---
    [/^Hey there,\s*what should we build today\?$/i, '嗨，今天想建構什麼？'],
    [/^Hey\s+(.+?),\s*what should we build today\?$/i, '嗨，$1，今天想建構什麼？'],
    [/^Welcome back,\s*(.+?)\.\s*Where should we pick up\?$/i, '歡迎回來，$1。我們從哪裡繼續？'],
    [/^Welcome back\.\s*Where should we pick up\?$/i, '歡迎回來。我們從哪裡繼續？'],
    [/^Good to see you,\s*(.+?)\.\s*What's next\?$/i, '很高興見到你，$1。接下來做什麼？'],
    [/^Good to see you\.\s*What's next\?$/i, '很高興見到你。接下來做什麼？'],
    [/^Version\s+([\d.]+)$/i, '版本 $1'],
    [/^Turn\s+(\d+)\s+of\s+(\d+)$/i, '第 $1 輪（共 $2 輪）'],
    [/^(\d+)\s+projects?$/i, '$1 個專案'],
    [/^See\s+(\d+)\s+more$/i, '檢視另外 $1 項'],
    [/^Toggle\s+(.+)$/i, '切換 $1'],
    [/^([\d,.]+)% of the customization budget is available\.?$/i, '$1% 的自訂擴充功能預算可用。'],
    [/^of the customization budget is available\.?$/i, '的自訂擴充功能預算可用。'],
    [/^Show (\d+) breakdowns?$/i, '顯示 $1 項明細'],
    [/^Hide (\d+) breakdowns?$/i, '隱藏 $1 項明細'],
    [/^(\d+) demoted$/i, '$1 項已降級'],
    [/^(\d+) excluded$/i, '$1 項已排除'],
    [/^(\d+)\s+tools?\s+excluded$/i, '已排除 $1 個工具'],
    [/^(\d+)\s+tools?\s+enabled$/i, '已啟用 $1 個工具'],
    [/^(\d+)\s+tools?\s+disabled$/i, '已停用 $1 個工具'],
    [/^(\d+)\s+tools$/i, '$1 個工具'],
    [/^Plugin:\s*(.*)$/i, '外掛：$1'],
    [/^Build with (.+) Plugins$/i, 'Build with $1 外掛'],
    [/^There are currently no Build with (.+) plugins available\.?$/i, '當前暫無可用的 Build with $1 外掛。'],
    [/^Failed to enable plugin (.+)$/i, '啟用外掛 $1 失敗'],
    [/^Failed to update agent:\s*(.+)$/i, '更新代理程式失敗：$1'],
    [/^Failed to remove agent:\s*(.+)$/i, '移除代理程式失敗：$1'],
    [/^Failed to remove plugin:\s*(.+)$/i, '移除外掛失敗：$1'],
    [/^Failed to toggle plugin:\s*(.+)$/i, '切換外掛狀態失敗：$1'],
    [/^Error updating agent:\s*(.+)$/i, '更新代理程式出錯：$1'],
    [/^Failed to write MCP config:\s*(.+)$/i, '寫入 MCP 配置失敗：$1'],
    [/^Failed to load skills:\s*(.+)$/i, '載入技能失敗：$1'],
    [/^Failed to scan skills config file:\s*(.+)$/i, '掃描技能配置檔案失敗：$1'],
    [/^Failed to revalidate slash commands:\s*(.*)$/i, '重新驗證斜槓命令失敗：$1'],
    [/^Failed to add plugin\.?\s*(?:Please try again\.?)?$/i, '新增外掛失敗。請重試。'],
    [/^Unnamed [Aa]gent (\d+)$/, '未命名代理程式 $1'],
    [/^Unnamed [Ss]kill (\d+)$/, '未命名技能 $1'],
    [/^UI Extension (\d+)$/, '介面擴充功能 $1'],
    [/^Automation (\d+)$/, '自動化任務 $1'],
    [/^Rule (\d+)$/, '規則 $1'],
    [/^Branch ([\w./-]+)$/, '分支 $1'],
    [/^All changes since (.+)$/i, '自 $1 以來的全部更改'],
    [/^(\d+) commits? to push$/i, '$1 個待推送的提交'],
    [/^(\d+) commits? to pull$/i, '$1 個待拉取的提交'],
    [/^(?:All |全部)?scheduled tasks run as (.+?)\.?$/i, '所有計劃任務均以 $1 模型執行。'],
    [/^scheduled tasks run as (.+?)\.?$/i, '計劃任務均以 $1 模型執行。'],
    [/^(?:All |全部)?plugins run as (.+?)\.?$/i, '所有外掛均以 $1 模型執行。'],
    [/^(?:All |全部)?automations run as (.+?)\.?$/i, '所有自動化任務均以 $1 模型執行。'],
    [/^Review permissions for (.+)$/i, function (m, name) { return '審查 ' + translateCaptured(name) + ' 的權限'; }],
    [/^(.+) needs a few details from you before it can run\.$/i, '$1 執行前需要您補充幾項詳細資訊。'],
    [/^Agents created by (.+) run in a dedicated (?:project|workspace) with its own permissions, which you can change anytime in the (?:project|workspace) settings page\.? On top of those defaults, (.+) requests the access below\.$/i, '由 $1 建立的代理程式將在專屬工作區中執行並擁有獨立權限，您可以隨時在設定頁面中更改。除預設權限外，$2 還請求以下存取權限。'],
    [/^Agents created by (.+) run in a dedicated (?:project|workspace) with its own permissions, which you can change anytime in the (?:project|workspace) settings page\.?$/i, '由 $1 建立的代理程式將在專屬工作區中執行並擁有獨立權限，您可以隨時在設定頁面中更改。'],
    [/^On top of those defaults, (.+) requests the access below\.$/i, '除預設權限外，$1 還請求以下存取權限。'],
    [/^Message from (.+)$/i, '來自 $1 的訊息'],
    [/^Executing task:\s*(.+)$/i, '正在執行任務：$1'],
    [/^Send feedback as (.+)$/i, '以 $1 身份傳送反饋'],
    [/^Models within this group:\s*(.*)$/i, '該分組包含的模型：$1'],
    [/^Select model,\s*current:\s*(.+)$/i, function (m, cur) { return '選擇模型，當前：' + translateString(cur.trim()); }],
    [/^Select project,\s*current:\s*(.+)$/i, function (m, cur) { return '選擇專案，當前：' + translateCaptured(cur.trim()); }],
    // 檔案卡片/表格按鈕的無障礙標籤（只用於 aria-label 場景）
    [/^Open\s+(.+)$/i, function (m, name) { return '開啟 ' + name; }],
    // 語音選擇器：「Fola, voice 1 of 9」
    [/^(.+),\s*voice (\d+) of (\d+)$/i, function (m, name, i, n) { return name + '，第 ' + i + ' 個語音（共 ' + n + ' 個）'; }],
    // 模型用量標籤：「Gemini 4 Argon Weekly Limit」/「... 5-Hour Limit」
    [/^(.+?)\s+(Weekly Limit|5-?Hour Limit)$/i, function (m, model, kind) {
      const label = /^weekly/i.test(kind) ? '每週限額' : '5 小時限額';
      return translateCaptured(model) + ' ' + label;
    }],
    [/^(\d+) models selected$/i, '已選擇 $1 個模型'],
    [/^Auth code for (.+)$/i, '$1 的授權碼'],
    [/^The (.+) MCP server requires configuration parameters before it can be started\.?$/i, '$1 MCP 伺服器需要先配置參數才能啟動。'],
    [/^See more in (.+)$/i, function (m, name) { return '在 ' + translateCaptured(name) + ' 中檢視更多'; }],
    [/^See less in (.+)$/i, function (m, name) { return '在 ' + translateCaptured(name) + ' 中收起'; }],
    [/^(?:More actions|更多操作) for (.+)$/i, function (m, name) { return translateCaptured(name) + ' 的更多操作'; }],
    [/^(.+),\s*setup required$/i, '$1（需要配置）'],
    [/^Tool Definition:\s*(.+)$/i, '工具定義：$1'],
    [/^Invocation:\s*(.+)$/i, '呼叫：$1'],
    [/^Agent permissions preset selector, current:\s*(.+)$/i, '代理程式權限預設選擇器，當前：$1'],
    [/^Undo to (?:this point|here)\.?$/i, '撤銷到此處'],
    [/^Search tasks[.…]*$/i, '搜尋任務...'],
    [/^Search conversations[.…]*$/i, '搜尋對話...'],
    [/^Enter scheduled task name[.…]*$/i, '輸入計劃任務名稱...'],
    [/^Enter a prompt for the agent to run[.…]*$/i, '輸入供代理程式執行的提示詞...'],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*[-\u2013\u2014]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i, function (m, mo1, d1, mo2, d2) { return MONTH_CN[mo1.toLowerCase()] + d1 + '日 - ' + MONTH_CN[mo2.toLowerCase()] + d2 + '日'; }],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*[-\u2013\u2014]\s*(\d{1,2})$/i, function (m, mo, d1, d2) { return MONTH_CN[mo.toLowerCase()] + d1 + '日 - ' + d2 + '日'; }],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)?$/i, function (m, mo, d, y, t, ap) { return y + '年' + MONTH_CN[mo.toLowerCase()] + d + '日 ' + (ap ? meridiem(ap) + ' ' : '') + t; }],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)?$/i, function (m, mo, d, t, ap) { return MONTH_CN[mo.toLowerCase()] + d + '日 ' + (ap ? meridiem(ap) + ' ' : '') + t; }],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4})$/i, function (m, mo, d, y) { return y + '年' + MONTH_CN[mo.toLowerCase()] + d + '日'; }],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i, function (m, mo, d) { return MONTH_CN[mo.toLowerCase()] + d + '日'; }],
    [/^(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)$/i, function (m, t, ap) { return meridiem(ap) + ' ' + t; }],
    // --- 吸收自 Zero-Touch 專案（antigravity-chinese-Zero-Touch） ---
    [/^(\d+)\s*([smhd])\s+ago$/i, function (m, n, u) { return n + ' ' + { s: '秒', m: '分鐘', h: '小時', d: '天' }[u.toLowerCase()] + '前'; }],
    [/^Load older messages,\s*showing\s+(\d+)\s+of\s+(\d+)$/i, '載入更早的訊息（已顯示 $1 / $2）'],
    [/^showing\s+(\d+)\s+of\s+(\d+)$/i, '已顯示 $1 / $2'],
    [/^Fold lines\s+(\d+)\s*-\s*(\d+)$/i, '摺疊第 $1-$2 行'],
    [/^Run command:\s*(.+)$/i, '執行命令：$1'],
    [/^Remove\s+(.{1,40})$/i, function (m, name) { return '移除 ' + translateCaptured(name); }],
    // --- 吸收自 AntigravityCN 專案 ---
    [/^Thinking\s*\((.+)\)$/i, '正在思考（$1）'],
    [/^(\d+)\s+searches?$/i, '$1 次搜尋'],
    [/^(\d+(?:\.\d+)?%?)\s+remaining$/i, '$1 剩餘'],
    [/^(\d+)\s+hours?\s+(\d+)\s+minutes?$/i, '$1 小時 $2 分鐘'],
    [/^(\d+)\s+minutes?$/i, '$1 分鐘'],
    [/^(\d+)\s+hours?$/i, '$1 小時'],
    [/^(\d+)\s+days?$/i, '$1 天'],
    [/^(\d+)\s+seconds?$/i, '$1 秒'],
    // 側欄相對時間縮寫（3d / 2h / 5m / 1w / 2mo / 1y），僅匹配「數字+單位」的整串
    [/^(\d+)\s*d$/i, '$1 天'],
    [/^(\d+)\s*h$/i, '$1 小時'],
    [/^(\d+)\s*m$/i, '$1 分鐘'],
    [/^(\d+)\s*w$/i, '$1 周'],
    [/^(\d+)\s*mo$/i, '$1 個月'],
    [/^(\d+)\s*y$/i, '$1 年'],
    // --- 權限確認彈窗按鈕（插入命令後的動態形式）---
    [/^Yes, and always allow '([\s\S]+)' in this conversation$/i, '是，且在此對話中始終允許 \'$1\''],
    [/^Yes, and always allow '([\s\S]+)' in this project$/i, '是，且在此專案中始終允許 \'$1\''],
    [/^Yes, and always allow '([\s\S]+)' when not in a project$/i, '是，且在非專案時始終允許 \'$1\''],
    [/^Yes, and always allow '([\s\S]+)'$/i, '是，且始終允許 \'$1\''],
    [/^Yes, allow '([\s\S]+)' this time$/i, '是，僅允許本次執行 \'$1\''],
    [/^Yes, allow '([\s\S]+)'$/i, '是，允許 \'$1\''],
    // --- v2.35.1 & 外掛市場 README 動態規則 ---
    [/^Working Directory:\s*(.+)$/i, '工作目錄：$1'],
    [/^Moved to (.+?)\.?$/i, function (m, t) { return '已移至 ' + translateCaptured(t) + '。'; }],
    [/^Remote MCP Server \((.+)\)$/i, '遠端 MCP 伺服器（$1）'],
    [/^Agent Skill \((.+)\)$/i, '代理程式技能（$1）'],
    [/^GitHub Repository \((.+)\)$/i, 'GitHub 存放庫（$1）'],
    [/^Option (\d+):\s*(.+)$/i, function (m, n, t) { return '方式 ' + n + '：' + translateCaptured(t); }],
    [/^(\d+)\.\s+Enable the (.+)$/i, '$1. 啟用 $2'],
    [/^(\d+)\.\s+Configure (.+)$/i, '$1. 配置 $2']
  ];

  // 動態規則裡捕獲到的名稱（如快捷鍵動作名）再走一次詞典，避免中英混排
  function translateCaptured(s) {
    if (!s) return s;
    const t = s.trim();
    if (!t) return s;
    const hit = exactLookup.get(t);
    if (hit !== undefined) return hit;
    const lowerHit = lowerLookup.get(t.toLowerCase());
    if (lowerHit !== undefined) return lowerHit;
    return s;
  }

  function translateString(text) {
    if (!text) return text;
    const trimmed = text.trim();
    if (!trimmed) return text;

    // --- 純標點節點：獨立渲染的英文標點轉中文標點（如 DOM 拆分的 "?" 節點）---
    if (/^[?.!,;:]+$/.test(trimmed)) {
      const puncMap = { '?': '？', '.': '。', '!': '！', ',': '，', ';': '；', ':': '：' };
      let puncOut = '';
      for (const ch of trimmed) puncOut += puncMap[ch] || ch;
      return text.replace(trimmed, puncOut);
    }

    // 沒有英文字母的節點直接跳過（中文、數字、純符號等）
    if (!/[A-Za-z]/.test(trimmed)) return text;

    // 純鍵盤快捷鍵組合保持原樣（如 "Ctrl+Shift+P"）；帶說明文字的標籤仍交給動態規則
    if (/^(?:Ctrl|Cmd|Command|Alt|Option|Shift|Meta|Super|⌘|⌥|⇧|⌃)(?:\s*[+\-]\s*(?:Ctrl|Cmd|Command|Alt|Option|Shift|Meta|Super|[A-Za-z0-9[\]\\;',./`=+\-↑↓←→⇥]))+$/i.test(trimmed)) return text;

    // 結果快取：設定頁大量重複文案，避免重複跑動態規則
    if (trimmed.length <= CACHE_MAX_TEXT) {
      const cached = translationCache.get(text);
      if (cached !== undefined) return cached;
    }

    const result = translateStringUncached(text, trimmed);
    if (trimmed.length <= CACHE_MAX_TEXT) {
      if (translationCache.size >= CACHE_LIMIT) translationCache.clear();
      translationCache.set(text, result);
    }
    return result;
  }

  function translateStringUncached(text, trimmed) {
    // --- Dynamic Agent Logs Regex Rules ---
    let dynamicMatch = trimmed;
    let isDynamic = false;

    if (/^Worked for [\d smhd.]+(?:\s*·\s*\d+ updates?)?$/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(
        /Worked for ([\d smhd.]+)(?:\s*·\s*(\d+) updates?)?$/,
        function (_, d, n) {
          return '已工作 ' + fmtDuration(d) + (n ? ' · ' + n + ' 次更新' : '');
        });
      isDynamic = true;
    }
    if (/^Thought for [\d smhd.]+(?:\s*·\s*\d+ updates?)?$/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(
        /Thought for ([\d smhd.]+)(?:\s*·\s*(\d+) updates?)?$/,
        function (_, d, n) {
          return '已思考 ' + fmtDuration(d) + (n ? ' · ' + n + ' 次更新' : '');
        });
      isDynamic = true;
    }
    if (/^Edited .* \+\d+ -\d+$/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/Edited (.*) \+(\d+) -(\d+)/, '編輯了 $1 (+$2 -$3)');
      isDynamic = true;
    }
    if (/^\d+ files? changed$/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^(\d+) files? changed(.*)/, '$1 個檔案已更改$2');
      isDynamic = true;
    }
    if (/^Explored/.test(trimmed)) {
      if (/^Explored \d+ files?$/.test(trimmed)) {
        dynamicMatch = dynamicMatch.replace(/^Explored (\d+) files?(.*)/, '瀏覽了 $1 個檔案$2');
      } else if (/^Explored (.*)$/.test(trimmed)) {
        dynamicMatch = dynamicMatch.replace(/^Explored (.*)/, '瀏覽了 $1');
      }
      isDynamic = true;
    }
    if (/^Canceled taskkill/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Canceled (.*)/, '已取消 $1');
      isDynamic = true;
    }
    if (isDynamic) return text.replace(trimmed, dynamicMatch);

    // 1. 精確匹配（先區分大小寫，再大小寫不敏感，Map O(1)）
    const trimmedLower = trimmed.toLowerCase();
    const exact = exactLookup.get(trimmed);
    if (exact !== undefined) return text.replace(trimmed, exact);
    const exactLower = lowerLookup.get(trimmedLower);
    if (exactLower !== undefined) return text.replace(trimmed, exactLower);

    // 2. 去掉尾部標點後再精確匹配
    let core = trimmed;
    let trailPunc = '';
    let matchPunc = '';
    const puncRegex = /(\.\.\.|…|\.|\?|!|:|：|？|！|。)$/;
    const match = core.match(puncRegex);
    if (match) {
      matchPunc = match[0];
      core = core.slice(0, -matchPunc.length).trim();
      if (matchPunc === '.') trailPunc = '。';
      else if (matchPunc === '?') trailPunc = '？';
      else if (matchPunc === '!') trailPunc = '！';
      else if (matchPunc === ':') trailPunc = '：';
      else if (matchPunc === '：') trailPunc = '：';
      else if (matchPunc === '？') trailPunc = '？';
      else if (matchPunc === '！') trailPunc = '！';
      else if (matchPunc === '。') trailPunc = '。';
      else trailPunc = matchPunc;
    }

    const coreExact = exactLookup.get(core);
    if (coreExact !== undefined) return text.replace(trimmed, coreExact + trailPunc);
    const coreExactLower = lowerLookup.get(core.toLowerCase());
    if (coreExactLower !== undefined) return text.replace(trimmed, coreExactLower + trailPunc);

    // 2.5 配額/時長中的英文單位先轉成中文（如 "6 days, 23 hours"）
    let dynamicInput = trimmed;
    if (/\d/.test(dynamicInput) && /\b(?:days?|hours?|minutes?|seconds?|weeks?|months?|years?)\b/i.test(dynamicInput)) {
      dynamicInput = translateDurationPhrases(dynamicInput);
    }

    // 2.6 動態正則規則兜底（整串錨定）
    for (var ri = 0; ri < dynamicRules.length; ri++) {
      if (dynamicRules[ri][0].test(dynamicInput)) {
        var ruleOut = dynamicInput.replace(dynamicRules[ri][0], dynamicRules[ri][1]);
        if (ruleOut !== dynamicInput) {
          return text.replace(trimmed, ruleOut);
        }
      }
    }

    // 3. 長句不再逐詞替換：無法整句命中時保持英文，避免中英夾雜（缺失詞條請補詞典）
    const hasChinese = /[一-龥]/.test(core);
    const wordsCount = core.split(/\s+/).filter(Boolean).length;
    if (wordsCount > 3) return text;
    if (hasChinese) return text;

    // 4. 短文本逐詞兜底：跳過郵箱/URL/路徑等，且僅當每個 >=2 字母的單詞都能在詞典中找到時才翻譯
    if (/[@]|:\/\/|~\//.test(core)) return text;
    const tokens = core.match(/[A-Za-z][A-Za-z'-]*/g) || [];
    if (!tokens.length) return text;
    for (var ti = 0; ti < tokens.length; ti++) {
      const token = tokens[ti];
      if (token.length < 2) continue;
      if (!tokenLookup.has(token.toLowerCase())) return text;
    }
    let out = core.replace(/[A-Za-z][A-Za-z'-]*/g, function (token) {
      const tr = tokenLookup.get(token.toLowerCase());
      return tr !== undefined ? tr : token;
    });
    out = out.replace(/([一-龥])\s+([一-龥])/g, '$1$2');
    if (matchPunc) out += trailPunc;
    return text.replace(trimmed, out);
  }

  // 時長短語：6 days, 23 hours -> 6 天 23 小時
  function translateDurationPhrases(s) {
    return s
      .replace(/(\d+)\s*days?\s*,\s*(\d+)\s*hours?/gi, '$1 天 $2 小時')
      .replace(/(\d+)\s*hours?\s*,\s*(\d+)\s*minutes?/gi, '$1 小時 $2 分鐘')
      .replace(/(\d+)\s*minutes?\s*,\s*(\d+)\s*seconds?/gi, '$1 分 $2 秒')
      .replace(/(\d+)\s*days?/gi, '$1 天')
      .replace(/(\d+)\s*hours?/gi, '$1 小時')
      .replace(/(\d+)\s*minutes?/gi, '$1 分鐘')
      .replace(/(\d+)\s*seconds?/gi, '$1 秒');
  }

  // 用於模糊匹配類名中包含程式碼/預覽/diff相關關鍵詞的正則
  const codeClassPattern = /(?:^|[\s_-])(hljs|shiki|prism|monaco|codemirror|line-number|line-content|gutter|codeblock|code-block|code-view|code-preview|file-preview|file-content|syntax-highlighting)(?:$|[\s_-])/i;

  const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, NOSCRIPT: 1, KBD: 1, SAMP: 1, VAR: 1 };
  const SKIP_SELECTOR = [
    '[contenteditable="true"]',
    '[data-language]', '[data-code]', '[data-line]', '[data-line-number]',
    '[role="code"]',
    '.cursor-edit', '.monaco-editor', '.editor-instance', '.input-area', '.chat-input',
    '.code-line', '.select-contain',
    '[class*="font-mono"][class*="rounded-xl"]'
  ].join(',');
  const TRIGGER_SELECTOR = '[data-testid="thinking-collapsible-trigger"],[data-testid="worked-for-collapsible"],[data-testid="tool-group-collapsible"]';
  const skipCache = new WeakMap();

  function shouldSkipNode(node) {
    if (!node) return true;
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element) return false;
    if (node.nodeType === Node.TEXT_NODE && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) return true;
    const cached = skipCache.get(element);
    if (cached !== undefined) return cached;

    let result = false;
    if (SKIP_TAGS[element.tagName]) {
      result = true;
    } else {
      // 思考鏈/模型回覆正文：模型生成的自由文本不逐詞翻譯；
      // 但觸發藥丸（已思考 X 秒 / 已工作 X）是系統 UI，放行。
      const container = element.closest && element.closest(
        '[data-testid="thinking-collapsible"],[data-testid="planner-response-text"],[data-testid="artifact-view"]'
      );
      if (container) {
        const trigger = element.closest(TRIGGER_SELECTOR);
        if (!(trigger && container.contains(trigger))) result = true;
      }
      if (!result && element.closest && element.closest(SKIP_SELECTOR)) result = true;
      if (!result && element.className && typeof element.className === 'string') {
        let cur = element;
        while (cur) {
          if (cur.className && typeof cur.className === 'string') {
            const lc = cur.className.toLowerCase();
            if (lc.includes('code-line') || lc.includes('select-contain') || codeClassPattern.test(cur.className)) {
              result = true;
              break;
            }
          }
          if (SKIP_TAGS[cur.tagName]) {
            result = true;
            break;
          }
          cur = cur.parentElement;
        }
      }
    }
    skipCache.set(element, result);
    return result;
  }

  function isKeyboardShortcutContext(node) {
    let el = node && node.parentElement;
    for (let depth = 0; depth < 4 && el; depth++, el = el.parentElement) {
      const txt = (el.textContent || '').trim();
      if (/(?:Ctrl|Cmd|Alt|Shift|Meta|Enter|Tab|Esc|⌘|⌥|⇧|⌃)\s*[+\-]/.test(txt)) return true;
    }
    return false;
  }

  const ATTR_NAMES = ['placeholder', 'title', 'aria-label', 'value'];

  let pendingQueue = [];
  let pendingHead = 0;
  let priorityQueue = [];
  let priorityHead = 0;
  let scheduled = false;
  const queuedNodes = new WeakSet();

  function scheduleQueue() {
    if (scheduled) return;
    scheduled = true;
    let done = false;
    const run = function (deadline) {
      if (done) return;
      done = true;
      processQueue(deadline);
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 200 });
      // 兜底：視窗背景化時 requestIdleCallback 可能被節流，用定時器保證佇列繼續推進
      setTimeout(run, 250);
    } else {
      setTimeout(run, 16);
    }
  }

  function enqueueNode(node, priority) {
    if (!node) return;
    const type = node.nodeType;
    if (type !== Node.TEXT_NODE && type !== Node.ELEMENT_NODE && type !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (queuedNodes.has(node)) return;
    queuedNodes.add(node);
    if (priority) priorityQueue.push(node);
    else pendingQueue.push(node);
    scheduleQueue();
  }

  function isDetached(node) {
    return node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE && node.isConnected === false;
  }

  // React 常把一句話拆成多個文本節點（如 "No automations yet"），
  // 若整個父節點的文本在詞典裡有整句譯文，就統一改寫，避免出現中英混雜
  function tryCompositeSentence(node, original) {
    const parent = node && node.parentElement;
    if (!parent || parent.childElementCount > 0) return false;
    const childNodes = parent.childNodes;
    if (childNodes.length < 2) return false;
    const own = (original || '').trim();
    if (!own) return false;
    const combined = (parent.textContent || '').replace(/\s+/g, ' ').trim();
    if (!combined || combined.length > 600 || !/[A-Za-z]/.test(combined)) return false;
    if (combined === own || !combined.includes(own)) return false;
    let hit = exactLookup.get(combined);
    if (hit === undefined) hit = lowerLookup.get(combined.toLowerCase());
    if (hit === undefined) return false;
    // 逐節點寫入，保留原有文本節點結構，避免影響 React 的節點引用
    let first = true;
    for (let i = 0; i < childNodes.length; i++) {
      const child = childNodes[i];
      if (child.nodeType !== Node.TEXT_NODE) continue;
      child.nodeValue = first ? hit : '';
      first = false;
    }
    return true;
  }

  // Markdown / 富文本段落常在內聯標籤（<strong>/<a>/<code>）前後拆分文本節點，
  // 用 {0}/{1} 佔位符整句匹配詞典，僅原地改寫已有 TEXT_NODE 的 nodeValue，不增刪 DOM 節點
  const RICH_BLOCK_TAGS = new Set(['P', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
  const RICH_INLINE_TAGS = new Set(['STRONG', 'B', 'EM', 'I', 'A', 'CODE', 'SPAN', 'KBD', 'MARK', 'SMALL', 'SUB', 'SUP']);
  const richTranslated = new WeakMap();

  function tryRichInlineSentence(node) {
    const parent = node && node.parentElement;
    if (!parent || !RICH_BLOCK_TAGS.has(parent.tagName)) return false;
    const elemCount = parent.childElementCount;
    if (elemCount < 1 || elemCount > 8) return false;
    if (shouldSkipNode(parent)) return false;

    const childNodes = parent.childNodes;
    const slots = [[]];
    let sig = '';
    let idx = 0;
    for (let i = 0; i < childNodes.length; i++) {
      const ch = childNodes[i];
      if (ch.nodeType === Node.TEXT_NODE) {
        slots[idx].push(ch);
        sig += ch.nodeValue || '';
      } else if (ch.nodeType === Node.ELEMENT_NODE) {
        if (!RICH_INLINE_TAGS.has(ch.tagName)) return false;
        sig += '{' + idx + '}';
        idx++;
        slots.push([]);
      } else if (ch.nodeType === Node.COMMENT_NODE) {
        continue;
      } else {
        return false;
      }
    }
    if (idx === 0) return false;
    sig = sig.replace(/\s+/g, ' ').trim();
    if (!sig || sig.length > 1000 || !/[A-Za-z]/.test(sig)) return false;
    if (richTranslated.get(parent) === sig) return true;

    let hit = exactLookup.get(sig);
    if (hit === undefined) hit = lowerLookup.get(sig.toLowerCase());
    if (hit === undefined) return false;

    const parts = [];
    let cursor = 0;
    for (let k = 0; k < idx; k++) {
      const token = '{' + k + '}';
      const pos = hit.indexOf(token, cursor);
      if (pos < 0) return false;
      parts.push(hit.slice(cursor, pos));
      cursor = pos + token.length;
    }
    parts.push(hit.slice(cursor));
    for (let k = 0; k < idx; k++) {
      if (parts.some(function (p) { return p.indexOf('{' + k + '}') >= 0; })) return false;
    }
    for (let k = 0; k <= idx; k++) {
      if (parts[k] !== '' && slots[k].length === 0) return false;
    }

    for (let k = 0; k <= idx; k++) {
      if (slots[k].length === 0) continue;
      slots[k][0].nodeValue = parts[k];
      for (let j = 1; j < slots[k].length; j++) slots[k][j].nodeValue = '';
    }
    richTranslated.set(parent, hit.replace(/\s+/g, ' ').trim());
    return true;
  }

  // 自由文本區（模型回覆/思考鏈/產物預覽）裡的文本不翻譯，但裡面的按鈕 aria/title
  // 仍是系統 UI，應當翻譯；程式碼區則連屬性一起跳過。
  function attrAllowedInSkipRegion(element) {
    try {
      if (SKIP_TAGS[element.tagName]) return false;
      const container = element.closest && element.closest(
        '[data-testid="thinking-collapsible"],[data-testid="planner-response-text"],[data-testid="artifact-view"]'
      );
      if (!container) return false;
      if (element.closest && element.closest(SKIP_SELECTOR)) return false;
      let cur = element;
      while (cur) {
        if (SKIP_TAGS[cur.tagName]) return false;
        if (cur.className && typeof cur.className === 'string') {
          const lc = cur.className.toLowerCase();
          if (lc.includes('code-line') || lc.includes('select-contain') || codeClassPattern.test(cur.className)) return false;
        }
        cur = cur.parentElement;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function translateAttributes(node) {
    let changed = false;
    for (let ai = 0; ai < ATTR_NAMES.length; ai++) {
      const attr = ATTR_NAMES[ai];
      if (!node.hasAttribute(attr)) continue;
      if (attr === 'value' && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA')) continue;
      if (node.tagName === 'INPUT' && attr === 'value' && node.type !== 'button' && node.type !== 'submit') continue;
      const original = node.getAttribute(attr);
      if (!original) continue;
      const translated = translateString(original);
      if (translated !== original) {
        node.setAttribute(attr, translated);
        changed = true;
      }
    }
    return changed;
  }

  function isNewActionContext(element) {
    try {
      if (!element || !element.closest) return false;
      if (element.closest('[data-testid*="new-button"]')) return true;
      const inActionEl = element.closest('button,[role="button"],a');
      if (!inActionEl) return false;
      if (element.closest('[data-tooltip-id],.rounded-full,[class*="bg-primary/10"],[class*="bg-secondary"],[data-model-label],[data-testid^="model-selector"]')) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function translateOne(node, priority) {
    if (!node || isDetached(node)) return;
    if (node.nodeType === Node.TEXT_NODE) {
      if (shouldSkipNode(node)) return;
      const original = node.nodeValue;
      if (!original || original.length > 20000) return;
      // 快捷鍵裡的 "," "." 等不能轉成全形標點
      if (/^[?.!,;:]+$/.test(original.trim()) && isKeyboardShortcutContext(node)) return;
      const trimmed = original.trim();
      if (trimmed === 'New' || trimmed === 'NEW') {
        const newLabel = isNewActionContext(node.parentElement) ? '新建' : '新';
        const nextVal = original.replace(trimmed, newLabel);
        if (nextVal !== original) node.nodeValue = nextVal;
        return;
      }
      if (tryCompositeSentence(node, original)) return;
      if (tryRichInlineSentence(node)) return;
      const translated = translateString(original);
      if (translated !== original) node.nodeValue = translated;
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const skipped = shouldSkipNode(node);
      if (skipped && !attrAllowedInSkipRegion(node)) return;
      translateAttributes(node);
      if (node.shadowRoot) enqueueNode(node.shadowRoot, priority);
      for (let i = 0; i < node.childNodes.length; i++) enqueueNode(node.childNodes[i], priority);
      return;
    }
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      for (let i = 0; i < node.childNodes.length; i++) enqueueNode(node.childNodes[i], priority);
    }
  }

  function processQueue(deadline) {
    scheduled = false;
    const start = performance.now();
    const budget = deadline && typeof deadline.timeRemaining === 'function'
      ? Math.max(2, Math.min(10, deadline.timeRemaining()))
      : 8;
    let processed = 0;
    const priorityBudget = 16;

    // 1) 優先處理新出現的 UI（設定彈窗、選單、對話流），避免初始頁面積壓導致新內容遲遲不翻譯
    while (priorityHead < priorityQueue.length) {
      const node = priorityQueue[priorityHead++];
      queuedNodes.delete(node);
      try {
        translateOne(node, true);
      } catch (e) {
        console.error('[Antigravity-ZH] translate error:', e);
      }
      processed++;
      if (processed >= 1000 || performance.now() - start > priorityBudget) break;
    }
    if (priorityHead >= priorityQueue.length) {
      priorityQueue = [];
      priorityHead = 0;
    } else if (priorityHead > 512 && priorityHead * 2 > priorityQueue.length) {
      priorityQueue = priorityQueue.slice(priorityHead);
      priorityHead = 0;
    }

    // 2) 空閒時間再處理初始頁面/歷史積壓
    if (priorityHead >= priorityQueue.length) {
      processed = 0;
      while (pendingHead < pendingQueue.length) {
        const node = pendingQueue[pendingHead++];
        queuedNodes.delete(node);
        try {
          translateOne(node, false);
        } catch (e) {
          console.error('[Antigravity-ZH] translate error:', e);
        }
        processed++;
        if (processed >= 300 || performance.now() - start > budget) break;
      }
      if (pendingHead > 512 && pendingHead * 2 > pendingQueue.length) {
        pendingQueue = pendingQueue.slice(pendingHead);
        pendingHead = 0;
      }
      if (pendingHead >= pendingQueue.length) {
        pendingQueue = [];
        pendingHead = 0;
      }
    }

    if (priorityHead < priorityQueue.length || pendingHead < pendingQueue.length) {
      scheduleQueue();
    }
  }

  const observerConfig = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'title', 'aria-label', 'value']
  };

  const observers = [];

  function handleMutations(mutations) {
    for (let mi = 0; mi < mutations.length; mi++) {
      const m = mutations[mi];
      if (m.type === 'childList') {
        for (let i = 0; i < m.addedNodes.length; i++) enqueueNode(m.addedNodes[i], true);
      } else if (m.type === 'characterData') {
        // 跳過引擎自己寫入的中文，避免「翻譯→再次入隊」的反饋迴圈
        const v = m.target.nodeValue || '';
        if (/[A-Za-z]/.test(v)) enqueueNode(m.target, true);
      } else if (m.type === 'attributes') {
        const v = m.target.getAttribute(m.attributeName) || '';
        if (/[A-Za-z]/.test(v)) enqueueNode(m.target, true);
      }
    }
  }

  function observeRoot(root) {
    const observer = new MutationObserver(handleMutations);
    observer.observe(root, observerConfig);
    observers.push(observer);
  }

  // Hook attachShadow
  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function() {
    const shadowRoot = originalAttachShadow.apply(this, arguments);
    observeRoot(shadowRoot);
    enqueueNode(shadowRoot, true);
    return shadowRoot;
  };

  function startObserver() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', startObserver);
      return;
    }
    enqueueNode(document.body, false);
    observeRoot(document.body);
  }

  // 外部詞典熱載入（函式定義在上方；此處呼叫時佇列/觀察器均已就緒）
  loadExternalDict();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  // 診斷介面（DevTools Console 可檢視）
  try {
    window.__AG_ZH__ = {
      version: 'v5.1',
      dictSize: Object.keys(combinedDict).length,
      translate: translateString,
      pending: function () { return (priorityQueue.length - priorityHead) + (pendingQueue.length - pendingHead); }
    };
  } catch (e) {}
})();
