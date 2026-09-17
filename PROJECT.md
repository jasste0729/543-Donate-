# 543 捐款回報 — PROJECT.md

> 文件定位：543 捐款回報專案長期交接／開發背景文件
> 用途：供未來 ChatGPT / Codex 在需求討論、程式修改、測試、部署與 Git 操作前閱讀。
> 原則：本文件記錄已確認的專案規格與決策；實際程式碼仍須以 Repository 現況驗證。若 Repository、Production 與本文件不一致，不得自行猜測，必須先回報差異。
> Current baseline date：2026-09-17
> Current Production：Version 85
> Current Git checkpoint：`e8c45ca0dbbde013cdfd105ad65ac977ae723533`
> P1 狀態：唯讀效能盤點已完成，尚未實作任何 P1 程式修改。

---

## 1. Project Overview

「543 捐款回報」是一套以 Google Apps Script、Google Sheets 與 LINE LIFF 為核心的捐款登記及付款回報系統。

主要功能：

- 捐款與捐款芳名登記
- 個案募款額度管理
- 一般捐款人本人登記
- 小幫手代填
- 重複登記提醒
- 多筆登記一次付款回報
- 收據需求回報
- 歷史 Email 自動帶入
- LINE 使用者身分記錄
- 後台／管理者操作

核心原則：

1. 手機與 LINE LIFF 使用情境優先。
2. 正式資料安全優先於重構便利性。
3. 多人同時操作時必須維持資料一致性。
4. 不得為效能任意移除 Script Lock。
5. 不得在一般 runtime 偷跑 migration。
6. 不得在一般 runtime 執行 autoResize。
7. Production、Git 與 Local 測試結果必須明確區分。

---

## 2. Current Production / Git Baseline

### Production

截至 2026-09-17 最後確認：

- Production Version：`85`
- Description：`performance optimize registration lock and runtime`
- 正式 Deployment：沿用既有 Production deployment
- Deployment ID：只可使用遮罩形式，例如 `AKfy...1wF4`
- 正式 URL：Version 84 → 85 時保持不變
- 新增 deployment：否
- 刪除 deployment：否

歷史 deployment 數量與 Version 保留狀態屬 Apps Script live state，未來執行 deployment 操作前必須重新以 `clasp deployments` 唯讀確認。

### Git

- Repository：`jasste0729/543-Donate-`
- Remote：`https://github.com/jasste0729/543-Donate-.git`
- Branch：`main`
- Current checkpoint：`e8c45ca0dbbde013cdfd105ad65ac977ae723533`
- Commit：`perf(registration): reduce lock contention and runtime sheet writes`
- `HEAD = origin/main`
- GitHub main 已同步 Production @85 source

### 重要版本

#### Production @83

- Version：83
- Description：`disable default batch report selection`
- 功能：PAYMENT-UI-004，付款回報頁預設不勾選任何登記
- Git checkpoint：`d65acf20347a41f9a33b3bd564aaef59cac3b8dc`
- Migration handoff：`0b12615acf047746a58612f8a2782fd6c9a168a4`

#### Production @84

- Version：84
- Description：`email autofill from LINE history`
- 功能：歷史 Email 自動帶入
- Git checkpoint：`06db24ae287d404032e3712dd7b53f4aca573ff5`

#### Production @85

- Version：85
- Description：`performance optimize registration lock and runtime`
- 功能：P0 / P0.1 登記效能與相容性修正
- Git checkpoint：`e8c45ca0dbbde013cdfd105ad65ac977ae723533`

---

## 3. System Architecture

### Frontend

主要檔案：

- `Index.html`
- `JavaScript.html`
- `Styles.html`

前端使用 Apps Script HTML Service、HTML、CSS、JavaScript、LINE LIFF 與 `google.script.run`。

### Backend

主要檔案：`Code.gs`

主要服務：

- SpreadsheetApp
- LockService
- CacheService
- PropertiesService
- HtmlService

### Manifest

檔案：`appsscript.json`

目前：

- Runtime：V8
- Time zone：Asia/Taipei
- 無 LINE email scope
- 不得自行修改 OAuth scope 或部署設定

### Data Storage

正式資料主要位於 Google Sheets。

主要已知 Sheet：

- `個案清單`
- `捐款登記總表`
- `${caseId}_捐款登記`

完整 Production Sheet inventory 尚未重新 live verify。

### Script Properties

已知使用：

- `LIFF_ID`
- `ADMIN_PASSWORD_HASH`
- `PAYMENT_BATCH_SEQUENCE_yyyyMMdd`

不得將實際 value 寫入 Repository 或交接文件。

### Admin Authentication

- Admin password hash 存於 Script Properties
- 使用 SHA-256
- Admin session 使用 CacheService
- Session TTL：6 小時
- Admin URL 慣例：`?admin=1`

---

## 4. Development Environment

正式專案路徑：

`C:\Users\TFLIN\Documents\ChatGPT\543 捐款回報`

新電腦移機時環境：

- Git：`2.55.0.windows.3`
- Node：`v24.19.0`
- npm：`11.17.0`
- clasp：`3.4.1`

`.clasp.json`：

- 存在於專案根目錄
- 指向原正式 Apps Script Project
- `rootDir = .`
- 由 `.gitignore` 忽略
- 不得 commit
- 回報 Script ID 時必須遮罩

Local / Cloud @83 曾在獨立暫存目錄比對。五個主要 Apps Script 檔案語意一致；原始 byte hash 差異主要為 CRLF/LF 與檔尾換行。不可只依 raw SHA 判斷 Apps Script Local / Cloud 是否實質不同。

---

## 5. Core Data Model

### Case

來源：`個案清單`

目前 `HEADERS.cases`：

1. 個案編號
2. 個案名稱
3. 目標金額
4. 目前登記金額
5. 是否開放
6. 狀態
7. 備註
8. 建立時間
9. 更新時間
10. 是否歷史專案

### Registration

Registration 同時保存於：

1. 個案專屬 `${caseId}_捐款登記`
2. `捐款登記總表`

目前 Repository 的 `HEADERS.registrations` 共 28 欄：

1. 登記編號
2. 個案編號
3. 代表人姓名
4. 代表人手機
5. 總金額
6. 付款方式
7. 捐款芳名清單
8. 是否需要收據
9. 收據狀態
10. 付款狀態
11. 入帳日期
12. 收據編號
13. 收據日期
14. 登記時間
15. 更新時間
16. LINE使用者ID
17. LINE顯示名稱
18. 資料來源
19. 回報者LINE使用者ID
20. 回報者LINE顯示名稱
21. 付款帳號末五碼
22. 付款批號
23. 本次付款總額
24. 收據開立方式
25. Email
26. 備註
27. 建立者LINE使用者ID
28. 建立者LINE顯示名稱

欄位名稱與順序以 Repository 的 `Code.gs` 為準。正式 Production Sheet 的 physical header 在執行 maintenance 前仍須唯讀確認。

### Header Mapping

Backend 使用 `FIELD_ALIASES` 依 header 名稱 mapping，降低硬編 column index 的風險，並支援部分 legacy header 名稱。

### Registration ID

格式：`caseId-###`，例如 `E114-001`。

目前算法為相同 caseId row count + 1。若資料只剩 `P0-001`、`P0-003`，下一筆可能再次產生 `P0-003`。這是已知 correctness risk，目前尚未修正；它不是目前主要效能瓶頸。

### Source Type / LINE Identity

Source type 至少包含：

- `self_created`
- `helper_created`

LINE identity：

- `LINE使用者ID`／`LINE顯示名稱`：registration owner
- `回報者LINE使用者ID`／`回報者LINE顯示名稱`：實際付款回報者
- `建立者LINE使用者ID`／`建立者LINE顯示名稱`：實際建立者

三組 identity 不得混用。

`helper_created`：

- donor owner LINE 欄位保持空白
- helper LINE identity 寫入 createdBy 欄位
- 不使用一般前台 `checkDuplicateRegistration`
- 不使用 `duplicateCheckVersion`／`duplicateConfirmed`
- 不執行一般本人登記的 backend final duplicate re-check

以上是目前既有行為，不得在效能修改中順便改變。

### Payment / Receipt / Memo

- Payment batch ID：`PByyyyMMdd####`
- Sequence property：`PAYMENT_BATCH_SEQUENCE_yyyyMMdd`
- Payment last 5：恰好 5 位數字；現金使用 `00000`
- Memo：`String(payload.memo || '').trim()`
- Memo 只保存真正備註，不得重新拼入 payment last5、receipt mode 或 Email
- 舊歷史 combined memo 保持原狀，不強制 rewrite

---

## 6. Registration Business Rules

### 基本驗證

`createRegistration` 至少驗證：

- payload 存在
- caseId 存在
- representativeName 存在
- totalAmount > 0
- donors 至少一筆

### Initial Status

新 registration：

- paymentStatus：`待付款`
- receiptStatus：`待回報`
- payment date／receipt no／receipt date／payment batch：空白

### Current Amount

- 排除 `paymentStatus = 已取消`
- 其餘 registration 計入
- legacy blank payment status normalize 為待付款

P0 後不再 append 後重掃整張 case sheet，而是使用 append 前的 existing current amount 加上 new amount。負數、NaN 或異常 legacy totalAmount 仍可能影響計算，屬既有資料風險。

### Capacity

最終 capacity check 必須在 Script Lock 內。

- `totalAmount > remainingAmount`：阻擋，不得 append 任一 registration Sheet
- `totalAmount === remainingAmount`：允許；完成後個案關閉並標記 `已額滿`

### Duplicate Protocol

Frontend 先執行 `checkDuplicateRegistration`，有 duplicate 時顯示 dialog。名稱 normalize 為 trim、移除空白、lowercase；duplicate scan 排除已取消資料。

Production @85 使用 `duplicateCheckVersion = 2`：

- 新 client 有新 duplicate 且未確認：backend block
- `duplicateConfirmed = true`：允許刻意重複
- Legacy／stale client 缺 marker：維持舊行為

Backend 在取得 Script Lock 後保留 final duplicate re-check。

### Script Lock / Double Submit

- 使用 `LockService.getScriptLock()`
- 等待上限 `REGISTRATION_QUEUE_WAIT_MS = 45000`
- 保留 Script Lock
- 不改 UserLock／per-user lock
- 不以提高 timeout 掩蓋效能問題

送出後 submit button 必須在 duplicate pre-check、dialog、createRegistration、waitLock 與 backend 完成前維持 disabled，避免第二次送出。

---

## 7. Payment / Receipt Rules

### PAYMENT-UI-004

進入付款回報頁時：

- `selectedRecordIds` 為空
- 所有 registration 預設未勾選
- 不依 LINE User ID 自動全選
- 使用者必須自行選擇本次付款 registration

### reportRegistrationBatch

- 可一次回報多筆 registration
- 同一次付款共用 paymentBatchId 與 paymentBatchTotal
- 保留 Script Lock、final payment status、owner LINE ID、payment batch sequence、paymentLast5、receipt 與 memo 規則

### Email Autofill

Production @84 起，Email 來源為前端 `state.registrations`，current user 為 `state.lineUserId`。

自動帶入條件：

- 使用者選擇需要收據
- Email 欄位目前空白
- current LINE User ID 存在
- registration owner LINE ID 與 current user 相同
- 非 helper_created
- 存在有效歷史 Email

最近一筆判斷優先 `updatedAt`，fallback `createdAt`。Email 驗證沿用 `type="email"` 與 input `checkValidity()`。

不得使用：

- reportedLineUserId
- createdByLineUserId
- LINE email scope

使用者手動輸入不得被覆蓋；自動帶入後使用者修改時，黃色提示隱藏且不再次自動覆蓋。

提示文字：

「系統已幫你填入上次使用的 Email，請看一下有沒有錯。」

---

## 8. Performance P0 / P0.1

### 原始問題

2026-09-16 舊版：

- createRegistration：45.539 秒 FAIL
- createRegistration：45.566 秒 FAIL
- createRegistration：28.238 秒 PASS
- getMyRegistrationData：約 9.266～13.351 秒
- reportRegistrationBatch：63.184 秒 PASS

主要原因為 global Script Lock 內執行 full Sheet read、migration、full rewrite、autoResize、append、current amount full rescan 與多次 setValue。

### P0 / P0.1 已完成

- normal runtime migration = 0
- runtime autoResize = 0
- checkDuplicateRegistration pure read
- getMyRegistrationData pure read
- caseRows reuse
- current amount 不再 append 後重掃
- nextRecordId_ 重用已讀 caseRows
- Script Lock critical section 縮小
- report batch touched-row write
- PERF logging
- duplicate protocol v2
- stale client compatibility
- double-submit guard
- header-only legacy maintenance fix

### Production Concurrent Test

Version 85，2 人幾乎同時送出：

A：

- execution：7.122 秒
- total：6,152 ms
- lock_wait：2,827 ms
- lock_held：3,305 ms
- sheet_read：1,261 ms
- duplicate_recheck：8 ms
- capacity_check：382 ms
- append_case：855 ms
- append_summary：249 ms
- case_status_update：428 ms
- result：PASS

B：

- execution：3.969 秒
- result：PASS
- 完整 phase PERF：未取得

資料驗證：

- record ID 不重複
- case sheet／summary 各新增一筆
- current amount 正確
- duplicate write：無
- lock timeout：無

P0 / P0.1 已正式結案。

---

## 9. P1 Read-only Audit

P1 效能瓶頸唯讀盤點已完成；目前尚未修改程式、clasp push、建立 Version、deploy、commit 或 git push。

### P1-1：reportRegistrationBatch

目前最大剩餘瓶頸：

- summary 同一 request 可能完整讀取兩次
- 每個涉及的 case sheet 仍需完整讀取
- 相同 case 的 getSheetByName 可能在去重前重複執行
- Sheet read 發生於 Script Lock 持有期間
- selected record 查找已使用 Map，主要問題不是 O(N×M)
- write side 已改善，read side 成為主要成本

建議：

- summary 只 resolve／讀取一次
- 建立 recordId → rowIndex／record Map
- unique case IDs 只計算一次
- 每個 unique case sheet 只 resolve／讀取一次
- 使用同一份 in-memory rows 完成 final validation 與 touched-row mapping
- 保留 Script Lock、paymentBatchId、付款規則與 touched-row grouped writes

必測 contiguous、non-contiguous、multi-case、ownership/status changed、payment total、paymentBatchId 與 summary/case consistency。

### P1-2：getMyRegistrationData / post-submit refresh

`getMyRegistrationData` 目前完整讀取 summary，對所有有 recordId 的 rows normalize，最後才依 LINE User ID filter。

最低風險方案：先依 raw LINE User ID column 篩選，再只 normalize current user rows。這能降低 Apps Script CPU，但不會減少 Sheet 傳輸量。

Post-submit 目前平行呼叫 `loadFrontCases()` 與 `loadMyRecordsData()`，success dialog 已先顯示。可考慮先將 backend response merge 到前端 state，但保留背景 authoritative refresh；不得直接取消 refresh。

### P1-3：PERF Observability

目前 PERF log 沒有 request correlation ID。建議加入非個資 short requestId，讓同一 request 的所有 phase 共用。

不得記錄姓名、手機、Email、LINE User ID、donor name、memo、payment last5 或 registration ID。

### 暫不優先處理

- createRegistration 微幅 RPC 優化
- appendRow 改 getLastRow + setValues
- nextRecordId_ PropertiesService sequence
- TextFinder
- registration／payment／duplicate／current amount cache
- getFrontCases 大改
- Script Lock 架構更換
- DB、Cloud SQL、Firestore、queue 或 transaction emulation

---

## 10. Cross-Sheet Consistency

一筆 createRegistration 依序執行：

1. append case registration sheet
2. append registration summary sheet
3. update case current amount／status

Google Sheets / Apps Script 沒有跨 Sheet transaction。仍可能發生 case append 成功但 summary append 失敗，或兩張 registration Sheet 成功但 case status update 失敗。

P0 改善執行時間與 Script Lock 持有時間，但沒有 rollback 或 transaction guarantee；cross-sheet partial failure risk 仍屬既有風險。

---

## 11. Maintenance Safety

以下 function 會修改 Sheet：

- `setupSheets()`
- `migrateAllRegistrationSheets()`
- `refreshAllCaseCurrentAmounts()`

### setupSheets()

不是安全的唯讀初始化。它可能寫入／重寫 header、在個案表只有 header 時加入示範資料、執行 summary migration，並建立 case registration sheets。不得在 Production 隨意執行。

### migrateAllRegistrationSheets()

會處理 summary 與所有 `*_捐款登記` Sheet，可能重建 header、轉換 rows、setValues、清除多餘欄位並 autoResizeColumns。

### refreshAllCaseCurrentAmounts()

會重新計算並寫入所有個案目前金額，不是唯讀 function。

`migrateAllRegistrationSheets()` 與 `refreshAllCaseCurrentAmounts()` 目前程式本身沒有 `requireAdmin_`。不得因為名稱是 maintenance，就假設 backend 已自動限制管理者。

執行 maintenance 前至少需要明確授權、確認目標 Spreadsheet、唯讀檢查 header、確認影響 Sheet，並具備備份／復原方案。

---

## 12. Testing Rules

每次修改必須區分 static call graph、syntax、local mock、Apps Script HEAD、測試 Version、Production deployment 與 Production manual test。不得把 Local PASS 寫成 Production PASS。

P0 / P0.1 歷史測試紀錄：

- Backend mock regression：18 PASS
- Frontend duplicate／防連點：8 PASS
- Batch row write：3 PASS
- Runtime call graph：4 PASS

以上是開發當時的歷史測試紀錄。目前 Repository 沒有完整可重跑的 automated test suite；未來修改仍須重新執行相關 regression，不得直接沿用歷史 PASS。

不得在 Production 做大量壓力測試。2 人 concurrent test 已足夠作為 P0 結案依據。

---

## 13. Git / Deployment Guardrails

修改前確認專案根目錄、branch、HEAD、origin/main、Working Tree、相關 source 與 actual call graph。

Stage 只加入本輪指定檔案，不使用無範圍控制的 `git add .` 或 `git add -A`。

Commit 前確認 diff、diff check、cached diff、secret scan、測試與 scope。

`clasp push` 只更新 Apps Script HEAD，不等於 Production deployment。正式更新一般需要 clasp push、建立 immutable Version，再更新既有 Production deployment。

Production 原則：

- Deployment ID 與正式 URL 保持不變
- 不建立不必要的新 deployment
- 不刪除歷史 deployment／Version
- deployment 前重新確認完整目標

Version 84 前曾遇到 versioned deployment 額度限制。歷史上明確指定後只 undeploy 舊 Version 59 測試 deployment，但仍無法建立 Version 84 獨立測試 deployment。不得假設刪除一個 deployment 就一定能新增一個。

---

## 14. Secret Safety

不論 GitHub Repository 實際 visibility，均按公開 Repository 安全標準處理。

不得 commit 或輸出：

- `.clasp.json`
- 完整 Script ID
- 完整 Deployment ID
- OAuth token
- Google credential
- Spreadsheet ID
- LIFF_ID value
- ADMIN_PASSWORD_HASH value
- API key
- password

Script ID、Deployment ID 若需回報，只能顯示遮罩。

---

## 15. Known Issues

- Cross-Sheet transaction／rollback：未解決
- nextRecordId_ count + 1：刪列後可能產生重複 ID
- Duplicate recordId legacy data：batch update 可能更新所有同 ID rows
- reportRegistrationBatch：summary 重複 full read 與 case read，列為 P1-1
- getMyRegistrationData：完整讀 summary 並先 normalize 後 filter，列為 P1-2
- PERF correlation：目前沒有 requestId，列為 P1-3
- Production Sheet inventory：尚未重新 live verify
- Backup / restore SOP：尚未建立完整版本

---

## 16. Current Handoff

截至 2026-09-17：

Production：

- Version：85
- Description：`performance optimize registration lock and runtime`

Git：

- Branch：main
- HEAD：`e8c45ca0dbbde013cdfd105ad65ac977ae723533`
- HEAD = origin/main
- Baseline Working Tree：clean

P0 / P0.1：

- 已實作
- 已部署
- 已完成 2 人 Production concurrent test
- 已建立 Git checkpoint
- 正式結案

P1：

- Repository 唯讀盤點已完成
- 尚未修改程式
- 尚未 clasp push
- 尚未建立 Version
- 尚未 deploy
- 尚未 commit／git push

下一個建議工作為 P1-1：安全重構 `reportRegistrationBatch`，讓 summary 與每個 unique case sheet 在同一 request 只讀一次，同時保留 final state validation、Script Lock、paymentBatchId、付款規則與 touched-row grouped writes。

---

## 17. Development Guardrails

任何修改都不得順便改變：

- duplicate 規則
- capacity
- current amount
- LINE identity
- self_created／helper_created
- payment batch
- receipt rules
- PAYMENT-UI-004
- Email autofill
- memo semantics
- Script Lock
- Sheet schema

不得重新引入 runtime migration、runtime autoResize、full Sheet rewrite 或付款自動全選。

不得因效能優化拿掉 duplicate dialog、submit disabled，或破壞手機 UI、Email 提示、正式 URL。

若 Repository、Production 與本文件不一致：

1. 停止修改
2. 回報差異
3. 說明實際 source
4. 等待確認
5. 不得自行猜測

---

## Final Consistency Notes

目前有效狀態：

- Production @85
- Git `e8c45ca...`
- P0 / P0.1 已結案
- P1 唯讀盤點已完成
- P1 尚未實作
- PAYMENT-UI-004 維持手動選取
- Email 使用歷史 registration，不使用 LINE email scope
- Memo 維持純備註
- normal runtime 不 migration
- normal runtime 不 autoResize
- Script Lock 保留
- reportRegistrationBatch 為 P1-1 首要候選

未來 ChatGPT / Codex 接手時：

1. 讀取 `PROJECT.md`
2. 確認專案根目錄
3. 確認 branch／HEAD／origin/main
4. 確認 Working Tree
5. 讀取 current source
6. 驗證文件與 Repository
7. 若有差異先回報
8. 再進行需求分析或修改
