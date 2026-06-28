# 部署步驟

## 1. 更新 Apps Script 程式

將本機檔案內容貼到 Apps Script 專案中：

- `Code.gs` 貼到 `程式碼.gs`
- `Index.html` 貼到 `Index`
- `Styles.html` 貼到 `Styles`
- `JavaScript.html` 貼到 `JavaScript`

貼完後按「儲存」。

## 2. 初始化或更新資料表

在 Apps Script 編輯器中執行：

```js
setupSheets()
```

執行後會建立或更新這兩個中文分頁：

- `個案清單`
- `捐款登記總表`
- 每個個案自己的登記分頁，例如 `E105_捐款登記`

如果已經有舊分頁 `Cases`、`Registrations` 或 `捐款登記`，程式會改名成中文總表，保留既有資料，並依照個案編號分流到各個個案分頁。

## 3. 重新部署 Web App

1. 點選「部署」>「管理部署作業」。
2. 選目前的 Web App 部署。
3. 點鉛筆圖示編輯。
4. 版本選「新增版本」。
5. 按「部署」。

如果是第一次部署：

1. 點選「部署」>「新增部署作業」。
2. 類型選擇「網頁應用程式」。
3. 執行身分選擇「我」。
4. 存取權選擇「任何人」。
5. 部署後複製 Web App URL。

前台網址：

```text
https://script.google.com/macros/s/.../exec
```

後台網址：

```text
https://script.google.com/macros/s/.../exec?admin=1
```

## 4. LINE LIFF

到 LINE Developers 建立 LIFF App，Endpoint URL 填入 Web App URL，Scope 至少勾選 `profile`。

設定 LIFF ID 時，在 Apps Script 執行：

```js
PropertiesService.getScriptProperties().setProperty('LIFF_ID', '你的 LIFF ID')
```
