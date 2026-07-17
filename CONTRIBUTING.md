# Contributing

感謝協助改善家計值班。

## 開始前

1. 不要提交任何真實 Gmail、財政部或家庭帳務資料。
2. 新功能應維持 Gmail 唯讀與最小權限原則。
3. 會改變資料庫結構時，必須提交對應 Drizzle migration。
4. 使用者可見文字以繁體中文為主。

## 驗證

送出變更前請執行：

```bash
npm install
npm run verify
```

## Pull Request

請說明變更目的、使用者影響、驗證方式，以及是否涉及 OAuth scope、資料遷移或新的外部服務。
