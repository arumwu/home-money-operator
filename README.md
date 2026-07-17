# 家計值班 / Home Money Operator

> 該繳的先提醒，花掉的自動記，家裡的錢一眼看清。

家計值班是一個家庭金錢值班台：管理水電、瓦斯、網路、房貸與訂閱的到期提醒，並從財政部電子發票平台定期寄到專用 Gmail 的附件，自動完成去重、解析、分類、記帳、統計與異常提醒。

## 自動化流程

1. 在財政部電子發票整合服務平台啟用「寄送消費資訊」。
2. 以 Google OAuth 的 `gmail.readonly` 權限連接專用 Gmail。
3. 系統讀取 CSV、TXT 或 ZIP 附件，以 Gmail message ID 與附件 SHA-256 雙重去重。
4. 解析發票號碼、日期、商家、統編、金額與品項。
5. 依商家與品項規則分類，寫入家庭帳本。
6. 更新本月統計，建立到期與異常消費提醒。

另外提供以 Bearer secret 保護的 `/api/inbound-email` adapter，讓非 Gmail 的收件服務也能送入同一條處理管線。

## 安全邊界

- Gmail 只要求唯讀 scope，不會寄信、刪信或改標籤。
- OAuth refresh token 使用伺服器端 AES-GCM 加密後才寫入 D1。
- OAuth state 使用 HMAC 且十分鐘失效。
- 只有家庭 owner 可以新增帳單、連接信箱或手動同步；後加入的成員預設為 viewer。
- 不把憑證、原始郵件或發票附件提交到 Git。

## 本機開發

需求：Node.js 22.13 以上。

```bash
npm install
npm run db:generate
npm run dev
```

Google OAuth 與排程所需的敏感值應放在未提交的環境變數：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `OAUTH_STATE_SECRET`
- `CRON_SECRET`
- `INBOUND_EMAIL_SECRET`
- `PRIMARY_OWNER_EMAIL`
- 選配：`GOOGLE_PUBSUB_TOPIC`、`GMAIL_QUERY`

OAuth Web 應用程式的 redirect URI 為：

```text
https://你的網站/api/gmail/callback
```

## 驗證

```bash
npm run verify
```

## 命名

- 產品：家計值班 / Home Money Operator
- Repository：`mars-tw/home-money-operator`
- Package：`@mars-tw/home-money-operator`
- CLI：`home-money`（保留名稱）
- MCP server：`home-money`（v1 暫不啟用）

本專案採用 [Morning Operator](https://github.com/mars-tw/morning-operator) 的「單一資料真相、冪等輸入、可檢視狀態、最小權限 adapter」思路，針對個人家用金錢管理重新設計。
