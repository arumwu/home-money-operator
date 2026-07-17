# Security Policy

## 回報安全問題

請不要在公開 Issue 張貼 OAuth Client Secret、refresh token、排程 secret、Sites bypass token、原始郵件、電子發票或家庭帳務資料。

若問題涉及真實憑證或私人資料，請先撤銷或輪替受影響的憑證，再以 GitHub Security Advisory 的私人回報功能聯絡維護者。

## 支援範圍

目前只維護 `main` 分支的最新版本。安全修正不保證回補到舊 commit。

## 已知安全邊界

- Gmail 僅使用 `gmail.readonly`。
- Refresh token 以伺服器端 AES-GCM 加密後寫入 D1。
- OAuth state 使用 HMAC，並在十分鐘後失效。
- 寫入與同步操作只允許家庭 owner。
- Cron、inbound email 與私密 Sites 閘道使用不同 secrets。
