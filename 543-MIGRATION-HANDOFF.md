# 543 捐款回報｜最終移機交接 MD

更新日期：2026-09-04
用途：交給新電腦 Codex 接手「543 捐款回報」Google Apps Script 專案。
狀態：移機前盤點完成，Cloud @83 source 已與舊電腦 Local 完全比對一致。

本文件不得放入任何密碼、Token、OAuth credential、完整 Script ID、完整 Deployment ID、完整 Spreadsheet ID、LIFF ID value、`ADMIN_PASSWORD_HASH` value。

## 1. 專案基本資料

```text
Project Path：
C:\Users\user\Desktop\543捐款回報

Git remote：
https://github.com/jasste0729/543-Donate-.git

Branch：
main

舊 Git HEAD：
2f617ccff5e293d07a31e281b16ccc264c0411d9

HEAD short：
2f617cc

HEAD commit：
Adjust duplicate donor dialog layout
```

目前 GitHub `main` 仍落後正式 Local / Cloud source。
尚未建立 Production @83 Git checkpoint。

## 2. 目前本機狀態

Git repository：是。
clasp 專案：是，根目錄有 `.clasp.json`。
目前 branch：`main`。
本機 HEAD 與 `origin/main` commit 一致，但 working tree 有正式功能修改尚未 commit。

目前已知 modified files：

```text
Code.gs
JavaScript.html
```

目前 staged files：

```text
無
```

目前 untracked files 包含：

```text
543-MIGRATION-HANDOFF.md
cloud-check-path.txt
create_explainer_video.ps1
docs/
explainer_subtitles*.ass
make_report_preview.py
mockup-registration-draft.svg
output/
package.json
package-lock.json
report_card_preview.png
report_preview_mockup.png
簡報1.pptx
```

注意：`cloud-check-path.txt` 是舊電腦 Cloud 比對留下的暫存路徑標記，不是正式程式檔。

## 3. Apps Script / clasp 狀態

```text
clasp version：
3.3.0

clasp login：
已恢復

登入帳號：
clw@tsairfa.com

.clasp.json：
存在

Script ID：
已遮罩，不在本文件輸出完整值
```

`.clasp.json` 內含正式 Apps Script Project 的 Script ID。
`.clasp.json` 被 `.gitignore` 排除，新電腦若只 clone GitHub 不會自動取得，需要安全帶入或重新 `clasp clone`。

遮罩後 Script ID：

```text
1nVGbd...WudiSTo
```

## 4. Production Deployment

目前正式 Web App deployment 已重新確認：

```text
Production version：
83

Description：
disable default batch report selection

Deployment ID：
AKfycbxQf...H1wF4

Web App URL：
https://script.google.com/macros/s/AKfycbxQf...H1wF4/exec

後台 URL：
同一 Web App URL 加 ?admin=1
```

本輪沒有 deploy。
本輪沒有建立新 deployment。
目前 deployment 數量很多，先前讀取為 37 個；未來若新增 deployment，可能再次遇到 Apps Script versioned deployments 上限。

## 5. Local vs Cloud @83 最終比對

比對方式：

```text
1. 沒有在原專案目錄執行 clasp pull
2. 建立獨立暫存目錄：
   C:\Users\user\Desktop\543捐款回報-cloud-check-20260904-142926
3. 在暫存目錄使用同一 .clasp.json 執行：
   clasp pull --versionNumber 83
4. 將 Cloud source 與舊電腦 Local source 做 SHA-256 比對
```

比對結果：

```text
Code.gs：一致
local=45472 / 9be83b2dea9b
cloud=45472 / 9be83b2dea9b

Index.html：一致
local=8665 / 5bc239e5cc00
cloud=8665 / 5bc239e5cc00

JavaScript.html：一致
local=84549 / e9b7afbf49bf
cloud=84549 / e9b7afbf49bf

Styles.html：一致
local=43823 / 4dc86b3eb837
cloud=43823 / 4dc86b3eb837

appsscript.json：一致
local=337 / 60ca3303a571
cloud=337 / 60ca3303a571
```

結論：

```text
舊電腦 Local source = Apps Script Cloud @83 source
GitHub main != Production @83 source
```

GitHub 還停在舊 HEAD `2f617ccff5e293d07a31e281b16ccc264c0411d9`，尚未包含目前 working tree 的正式修改。

## 6. 正式功能現況

### 6.1 備註正規化

狀態：已完成。

付款回報備註目前只保存使用者真正輸入的備註：

```js
memo: String(payload.memo || '').trim()
```

已確認：

```text
不再自動把付款末五碼組進 memo
不再自動把收據開立方式組進 memo
不再自動把 Email 組進 memo
未找到 memoParts 殘留
```

### 6.2 多筆付款回報

狀態：已完成。

已實作：

```text
reportRegistrationBatch
paymentBatchId
付款批號
本次付款總額
```

`paymentBatchId` 格式：

```text
PByyyyMMdd####
```

例：

```text
PB202609040001
```

用途：

```text
一次付款事件可對應多筆登記
同一次送出的多筆登記共用同一個 paymentBatchId
同一次送出的多筆登記共用同一個 本次付款總額
```

注意：

```text
有 LockService 避免併發衝突
沒有真正資料庫 transaction / rollback
Google Sheet 寫入中途失敗時仍有理論上的部分更新風險
```

### 6.3 PAYMENT-UI-004

狀態：已完成。

已確認：

```text
回報頁首次進入：預設全部未勾選
不會依同一 LINE ID 自動全選
不會依待處理紀錄自動全選
捐款者必須自行勾選本次實際付款紀錄
未選取時按鈕 disabled
未選取時顯示本次付款總額 0 元
點單筆付款回報 / 更正回報時，只預選該筆
多筆編輯取消後，回到使用者剛才自行勾選的狀態
送出成功後清空選取狀態
```

相關前端狀態：

```text
paymentReportMode
reportSelectedRecords
reportEditingHostId
reportEditingRecordIds
```

相關前端函式：

```text
syncReportSelection
selectedReportRecords
selectedReportTotal
openSelectedReportForm
renderInlineBatchSummary
reportPayment
resetPaymentReportMode
```

## 7. Registration Header 現況

以下以目前 `Code.gs` 實際 `HEADERS.registrations` 為準。

完整順序：

```text
登記編號
個案編號
代表人姓名
代表人手機
總金額
付款方式
捐款芳名清單
是否需要收據
收據狀態
付款狀態
入帳日期
收據編號
收據日期
登記時間
更新時間
LINE使用者ID
LINE顯示名稱
資料來源
回報者LINE使用者ID
回報者LINE顯示名稱
付款帳號末五碼
付款批號
本次付款總額
收據開立方式
Email
備註
建立者LINE使用者ID
建立者LINE顯示名稱
```

後段實際順序：

```text
資料來源
→ 回報者LINE使用者ID
→ 回報者LINE顯示名稱
→ 付款帳號末五碼
→ 付款批號
→ 本次付款總額
→ 收據開立方式
→ Email
→ 備註
→ 建立者LINE使用者ID
→ 建立者LINE顯示名稱
```

注意：

```text
使用者曾提出的後段順序是：
付款帳號末五碼 → 收據開立方式 → Email → 備註 → 付款批號 → 本次付款總額

但目前 Code.gs 實際順序不同。
本交接文件以程式現況為準，不猜、不自行調整。
```

新專案建立與既有資料遷移邏輯：

```text
ensureCaseRegistrationSheet_()
migrateExistingRows_()
canonicalRegistrationToRow_()
createRegistration()
createHelperRegistrations()
```

上述邏輯都依 `HEADERS.registrations` 與 `FIELD_ALIASES` 運作。

## 8. Sheet 現況與限制

已確認：

```text
程式核心 Sheet：
個案清單
捐款登記總表

個案登記 Sheet 命名規則：
${caseId}_捐款登記

例：
E108_捐款登記
```

依既有截圖曾看過：

```text
個案清單
捐款登記總表
E108_捐款登記
ALL
```

程式判斷個案登記 Sheet 的規則：

```js
/_捐款登記$/
```

所以 `ALL` 不符合個案登記 Sheet 規則，理論上不會被當成正式個案登記表讀取。

未即時確認：

```text
本輪未能透過既有唯讀函式重新確認完整工作表清單
本輪未能透過既有唯讀函式重新確認工作表數量
本輪未能透過既有唯讀函式重新確認實際 Sheet Header
```

原因：

```text
目前專案沒有既有「只列出 Spreadsheet / Sheet metadata」的唯讀函式
嘗試執行既有只讀函式 getFrontCases / listCases 時，Apps Script 執行端回 storage NOT_FOUND
本輪規則禁止新增診斷函式、禁止修改程式、禁止 Sheet 寫入
```

因此這部分只能標示為：

```text
程式規則已確認
實際 Cloud Sheet 清單未透過本輪工具即時確認
```

## 9. Script Properties 現況與限制

已確認：

```text
程式會使用 Script Properties
```

程式推定至少有下列 key：

```text
LIFF_ID
ADMIN_PASSWORD_HASH
PAYMENT_BATCH_SEQUENCE_yyyyMMdd
```

例如付款批號序號 key 形式：

```text
PAYMENT_BATCH_SEQUENCE_20260904
```

未即時確認：

```text
未能直接列出實際 Cloud Script Properties key 清單
```

原因：

```text
目前專案沒有既有「只列 Script Properties key、不列 value」的唯讀函式
本輪規則禁止新增診斷函式、禁止修改程式
```

重要：

```text
本文件只記 key 名稱或 key 格式
不得記任何 value
不得記 LIFF ID value
不得記 ADMIN_PASSWORD_HASH value
不得記 OAuth token
```

## 10. 敏感資料規則

不得放入 Git：

```text
完整 Script ID
完整 Deployment ID
完整 Spreadsheet ID
LIFF ID value
ADMIN_PASSWORD_HASH value
OAuth token
Password
Secret
Google credential
.clasprc.json
```

可用遮罩方式記錄：

```text
Script ID：1nVGbd...WudiSTo
Deployment ID：AKfycbxQf...H1wF4
Web App URL：https://script.google.com/macros/s/AKfycbxQf...H1wF4/exec
```

新電腦需要安全帶入：

```text
.clasp.json
```

或用同一 Google 帳號重新 `clasp clone` 正式 Apps Script Project。

## 11. 新電腦需要安裝

至少需要：

```text
Git
Node.js
npm
@google/clasp
Codex
Chrome
```

安裝 clasp：

```powershell
npm install -g @google/clasp
```

確認版本：

```powershell
git --version
node --version
npm --version
clasp --version
```

舊電腦目前版本：

```text
Git：2.55.0.windows.3
Node.js：v24.18.0
npm：11.16.0
clasp：3.3.0
```

目前 `package.json`：

```json
{
  "dependencies": {
    "ffmpeg-static": "^5.3.0"
  }
}
```

新電腦可用：

```powershell
npm install
```

重建 `node_modules/`。

## 12. 移機策略

目前新電腦不能只 clone GitHub main。

原因：

```text
GitHub main 尚未同步 Production @83
GitHub main 仍停在 2f617ccff5e293d07a31e281b16ccc264c0411d9
正式 Local / Cloud @83 已包含後續修改
```

正確流程：

舊電腦：

```text
1. 完成本 MD
2. 建立 Production @83 Git checkpoint
3. push origin/main
```

新電腦：

```text
1. clone origin/main
2. 安全帶入 .clasp.json
3. clasp login
4. clasp status
5. 唯讀確認 Local = Cloud
6. 再恢復開發
```

若舊電腦沒有先 commit/push：

```text
必須人工帶走整個專案資料夾
或至少帶走 Code.gs、JavaScript.html、.clasp.json、543-MIGRATION-HANDOFF.md
```

## 13. Git Checkpoint 前建議納入 Git 的檔案

必須納入：

```text
Code.gs
JavaScript.html
543-MIGRATION-HANDOFF.md
```

視需求納入：

```text
README.md
SETUP.md
docs/
package.json
package-lock.json
```

通常不納入：

```text
node_modules/
output/
.codex-remote-attachments/
*.pptx
*.mp4
*.jpg preview files
```

絕對不要納入：

```text
.clasprc.json
OAuth token
密碼
Secret value
ADMIN_PASSWORD_HASH value
LIFF ID value
```

## 14. 移機後第一次驗證清單

新電腦第一次接手後先做唯讀確認：

```powershell
git status --short
git remote -v
git branch -vv
git log -5 --oneline --decorate
clasp status
clasp deployments
```

檢查檔案：

```text
.clasp.json
appsscript.json
Code.gs
JavaScript.html
Styles.html
Index.html
543-MIGRATION-HANDOFF.md
```

檢查正式功能：

```text
reportRegistrationBatch
paymentBatchId
付款批號
本次付款總額
memo: String(payload.memo || '').trim()
paymentReportMode
syncReportSelection 不自動全選
Production @83
```

比對 Cloud：

```text
不要在正式工作目錄直接 clasp pull
先建立暫存目錄
複製 .clasp.json 到暫存目錄
在暫存目錄 clasp pull --versionNumber 83
再做 Local vs Cloud diff/hash
```

## 15. 禁止事項

新電腦第一次接手前禁止：

```text
不要修改程式
不要 clasp push
不要 deploy
不要 Sheet 寫入
不要 migration
不要 commit
不要 git push
不要 git reset --hard
不要 git clean
不要直接 clasp pull 覆蓋正式工作目錄
不要建立新的 Apps Script Project
不要刪除 deployment
不要把 secret 寫進 Git
```

## 16. 給新電腦 Codex 的第一個 Prompt（一鍵複製）

```text
【543 捐款回報｜新電腦第一次接手唯讀確認】

你正在新電腦接手「543 捐款回報」Google Apps Script 專案。

本輪只做唯讀確認。

不得：
- 修改程式
- clasp push
- deploy
- Sheet 寫入
- migration
- commit
- git push
- git reset
- git clean
- 直接在正式工作目錄 clasp pull 覆蓋檔案
- 建立新的 Apps Script Project

請先讀取：
543-MIGRATION-HANDOFF.md

然後檢查：

1. git status --short
2. git remote -v
3. git branch -vv
4. git log -5 --oneline --decorate
5. .clasp.json 是否存在
6. appsscript.json 是否存在
7. clasp status
8. clasp deployments
9. Production deployment 是否為 @83
10. Description 是否為 disable default batch report selection
11. Code.gs 是否有 reportRegistrationBatch
12. Code.gs 是否有 paymentBatchId
13. Code.gs 是否有 付款批號
14. Code.gs 是否有 本次付款總額
15. Code.gs 是否有 memo: String(payload.memo || '').trim()
16. JavaScript.html 是否有 paymentReportMode
17. JavaScript.html 的 syncReportSelection 是否不會自動全選
18. PAYMENT-UI-004 是否仍成立：回報頁預設全部未勾選

Local vs Cloud 比對規則：

- 不得直接在正式工作目錄 clasp pull
- 請建立暫存目錄
- 複製 .clasp.json 到暫存目錄
- 在暫存目錄執行 clasp pull --versionNumber 83
- 比對以下檔案：
  Code.gs / Cloud Code.js
  Index.html
  JavaScript.html
  Styles.html
  appsscript.json

請回報：

【543 新電腦接手唯讀確認】

Git：
- Remote：
- Branch：
- HEAD：
- Working Tree：

clasp：
- Login：
- Status：
- Production：

Local vs Cloud：
- Code.gs：
- Index.html：
- JavaScript.html：
- Styles.html：
- appsscript.json：

正式功能：
- reportRegistrationBatch：
- paymentBatchId：
- PAYMENT-UI-004：
- memo 正規化：
- Header 新版：

結論：
- 是否可恢復開發：
- 是否有風險：

本輪：
- 修改程式：否
- clasp push：否
- deploy：否
- Sheet 寫入：否
- migration：否
- commit：否
- git push：否

完成後立即停止。
```
