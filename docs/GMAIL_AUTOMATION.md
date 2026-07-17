# Gmail 與電子發票全自動化設定

這份文件說明如何讓「家計值班」定期從專用 Gmail 讀取財政部寄送的消費資訊附件，完成去重、解析、分類與入帳。

> 這個專案不使用 Gmail 密碼或應用程式密碼。每一個自行部署的家庭都應建立自己的 Google OAuth 應用程式，只授予 `gmail.readonly`。不要共用作者的 Client Secret。

## 完成後的資料流

```text
財政部電子發票整合服務平台
  → 定期寄送消費資訊到專用 Gmail
  → Gmail OAuth 唯讀授權
  → 家計值班定時同步附件
  → Gmail message ID + 附件 SHA-256 去重
  → 解析 CSV / TXT / ZIP
  → 分類、入帳、統計與異常提醒
```

## 1. 準備專用 Gmail

建議建立一個只接收家庭帳務資料的 Gmail，例如 `my.home.receipts@gmail.com`。網站登入帳號與這個 Gmail 可以不同；家計值班會把網站 owner 與實際授權的 Gmail 分開保存。

請先確認：

- 可以正常登入該 Gmail。
- 該帳號能收到外部郵件。
- 不要把 Gmail 密碼交給家計值班或任何排程服務。

## 2. 建立 Google Cloud 專案

1. 開啟 [Google Cloud Console](https://console.cloud.google.com/)。
2. 建立新專案，名稱可使用 `Home Money Operator`。
3. 到 [API Library](https://console.cloud.google.com/apis/library) 搜尋並啟用 **Gmail API**。
4. 到 [Google Auth Platform](https://console.cloud.google.com/auth/overview) 建立 OAuth 應用程式。

Google 官方流程：

- [Gmail API server-side OAuth](https://developers.google.com/workspace/gmail/api/auth/web-server)
- [建立 Google Workspace API 憑證](https://developers.google.com/workspace/guides/create-credentials)

## 3. 設定 OAuth 同意畫面

在 Google Auth Platform 依序設定：

1. **Branding**
   - App name：`家計值班`
   - User support email：你會收信的管理信箱
   - Developer contact：你會收信的管理信箱
2. **Audience**
   - 個人 Gmail 或家庭使用通常選 `External`。
   - 初次測試時，把專用 Gmail 加入 Test users。
3. **Data Access**
   - 加入 `openid`
   - 加入 `email`
   - 加入 `https://www.googleapis.com/auth/gmail.readonly`

`gmail.readonly` 可以讀取郵件與附件，但不能寄信、刪信或修改標籤。Google 將它列為 restricted scope；若要把同一組 OAuth 憑證提供給不特定使用者，必須依 Google Console 顯示的要求完成驗證，儲存 restricted-scope 資料的公開服務也可能需要安全評估。詳見 [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)。

### Testing 模式的七天限制

`External + Testing` 且要求 Gmail scope 時，refresh token 通常會在七天後失效。它適合先測通，不適合長期無人值守。

個人自架完成測試後，可依 Google Auth Platform 當下顯示的規則切換為 `In production`。未驗證的 external app 可能顯示警告並受使用者數量限制；若要提供公開多人服務，應完成 Google 要求的驗證。官方狀態說明：[OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)。

## 4. 建立 Web OAuth Client

1. 在 Google Auth Platform 的 **Clients** 頁面按 **Create client**。
2. Application type 選 **Web application**。
3. Name 可填 `Home Money Operator Web`。
4. Authorized redirect URI 加入正式站回呼網址：

```text
https://home-money-operator.arum-wu.chatgpt.site/api/gmail/callback
```

自行部署時，把網域替換成自己的 HTTPS 網域：

```text
https://YOUR_DOMAIN/api/gmail/callback
```

本機測試可另外加入：

```text
http://localhost:3000/api/gmail/callback
```

建立完成後會得到：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Client Secret 只放在部署平台的 secret 管理功能或未提交的本機 `.env`，不得寫進程式碼、Issue、CI log 或 Git commit。

## 5. 設定家計值班環境變數

複製 `.env.example` 建立未提交的 `.env`，或直接在部署平台設定 secrets。

| 名稱 | 用途 | 是否機密 |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Google Web OAuth Client ID | 是 |
| `GOOGLE_CLIENT_SECRET` | Google Web OAuth Client Secret | 是 |
| `TOKEN_ENCRYPTION_KEY` | 加密 Gmail refresh token | 是 |
| `OAUTH_STATE_SECRET` | 簽署 OAuth state、防止偽造回呼 | 是 |
| `PRIMARY_OWNER_EMAIL` | 第一位家庭管理者的網站登入 Email | 否 |
| `CRON_SECRET` | 保護自動同步端點 | 是 |
| `INBOUND_EMAIL_SECRET` | 保護非 Gmail 收件 adapter | 是 |
| `GMAIL_QUERY` | Gmail 搜尋條件 | 否 |
| `GOOGLE_PUBSUB_TOPIC` | 預留 Gmail watch topic；目前定時同步不需要 | 否 |

可用密碼管理器產生三組互不相同、至少 32 bytes 的隨機值，分別放入 `TOKEN_ENCRYPTION_KEY`、`OAUTH_STATE_SECRET` 與 `CRON_SECRET`。不要重複使用同一個值。

預設 Gmail 查詢：

```text
has:attachment newer_than:2y {subject:"消費發票彙整通知" filename:csv filename:zip filename:txt}
```

若財政部日後改變主旨或附件格式，可透過 `GMAIL_QUERY` 調整，不必修改程式。

## 6. 完成一次 Gmail 授權

1. 以 `PRIMARY_OWNER_EMAIL` 登入家計值班。
2. 在「電子發票」區塊按 **連接 Gmail**。
3. 在 Google 帳號選擇畫面選取專用 Gmail。
4. 確認只要求 Gmail 唯讀權限後同意。
5. 回到家計值班按 **立即同步**。

第一次授權會取得離線 refresh token。家計值班先以 AES-GCM 加密，再保存到 D1；之後 access token 到期時會自動更新，不需要保存 Gmail 密碼。

若沒有收到 refresh token：

1. 到 [Google Account 第三方連線](https://myaccount.google.com/connections) 移除舊的家計值班授權。
2. 回到網站重新按「連接 Gmail」。
3. 檢查 OAuth Client 的 redirect URI 是否完全相同，包括 `https` 與路徑。

## 7. 在財政部平台啟用寄送消費資訊

1. 登入 [財政部電子發票整合服務平台](https://www.einvoice.nat.gov.tw/)。
2. 確認手機條碼與常用載具已完成歸戶，否則消費資料可能不完整。
3. 進入通知設定頁面。
4. 啟用 **寄送消費資訊** 或 **消費發票彙整通知**。
5. 收件 Email 填入前面準備的專用 Gmail。
6. 收到第一封通知後，確認附件是 CSV、TXT 或 ZIP，再回家計值班執行一次「立即同步」。

財政部官方資料亦說明，可在整合服務平台的通知設定中啟用「寄送消費資訊」：[雲端發票說明 PDF](https://www.einvoice.nat.gov.tw/static/ptl/ein_upload/html/ESQ/Download/802_cloudinvoicepros.pdf)。平台選單名稱可能更新，請以登入後的實際畫面為準。

## 8. 啟用關閉瀏覽器後仍會執行的排程

網站開著時，前端每 30 分鐘會嘗試同步一次。要做到真正無人值守，外部排程器還必須定期呼叫：

```text
POST /api/cron/gmail-sync
Authorization: Bearer <CRON_SECRET>
```

建議頻率為每 15 至 30 分鐘。請勿短於 5 分鐘，以免浪費 Gmail API quota。

### 私密 OpenAI Sites 部署

私密 Sites 會先經過 Sign in with ChatGPT 閘道，因此排程器需要兩個彼此獨立的授權 header：

```text
Authorization: Bearer <CRON_SECRET>
OAI-Sites-Authorization: Bearer <SIWC_BYPASS_TOKEN>
```

`SIWC_BYPASS_TOKEN` 應由 Sites 產生或讀取，交給排程服務的 secret 管理功能。產生新 token 會使舊 token 立即失效；不要把它放進本倉庫。

測試範例：

```bash
curl --request POST \
  --header "Authorization: Bearer ${HOME_MONEY_CRON_SECRET}" \
  --header "OAI-Sites-Authorization: Bearer ${HOME_MONEY_SITES_BYPASS_TOKEN}" \
  https://home-money-operator.arum-wu.chatgpt.site/api/cron/gmail-sync
```

若部署在沒有額外登入閘道的平台，只需要第一個 `Authorization` header。

## 9. 驗收自動化

依序確認：

- Gmail 區塊顯示正確的專用 Gmail 地址。
- 手動同步回報新增與略過的發票數量。
- 重複執行同步不會重複入帳。
- 關閉瀏覽器後，排程執行時間會更新「最近同步」。
- 錯誤會出現在 Gmail 同步備註或值班提醒。
- `/api/cron/gmail-sync` 沒有正確 secret 時必須回傳 `401`。

## 10. 常見問題

### `redirect_uri_mismatch`

Google Cloud 的 Authorized redirect URI 必須與網站回呼網址逐字一致。正式站要使用 HTTPS。

### 七天後停止同步

通常是 OAuth app 仍在 `External + Testing`。重新授權只能再延長一次測試週期；長期自動化需要依 Google 規則調整發布狀態。

### 找不到財政部郵件

先在 Gmail 搜尋框直接測試 `GMAIL_QUERY`。若能找到郵件但沒有附件，確認通知設定是否選擇寄送消費明細，而非只有中獎通知。

### `invalid_grant` 或憑證更新失敗

可能是使用者撤銷授權、Google 密碼變更、refresh token 過期或 OAuth Client 被重建。移除舊授權後重新連接 Gmail。

### 附件被略過

系統只解析 `.csv`、`.txt` 與 `.zip`。同一 Gmail message attachment 或同一附件內容會被視為重複，這是預期行為。

## 11. 撤銷與輪替

- 停止 Gmail 存取：在 Google Account 的第三方連線頁移除授權。
- OAuth Client Secret 外洩：立即在 Google Cloud 輪替並更新部署 secrets。
- `CRON_SECRET` 外洩：產生新值並同步更新排程器。
- Sites bypass token 外洩：在 Sites 重新產生，舊 token 會立即失效。
- `TOKEN_ENCRYPTION_KEY` 不可任意更換；更換後既有 refresh token 將無法解密，必須重新連接 Gmail。

## 安全邊界

- 不提交 `.env`、OAuth secret、refresh token、排程 secret、原始郵件或發票附件。
- Gmail scope 固定為唯讀；任何擴權都必須另行審查。
- 排程 secret 與 Sites bypass token 必須分開保存。
- 公開原始碼不等於公開家庭資料；部署資料庫、Secrets 與成員存取權必須維持私有。
