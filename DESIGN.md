---
name: 家計值班
description: 該繳的先提醒，花掉的自動記，家裡的錢一眼看清。
colors:
  canvas: "oklch(95.5% 0.012 244)"
  canvas-deep: "oklch(91.5% 0.017 244)"
  surface: "oklch(98.5% 0.007 244)"
  surface-raised: "oklch(100% 0 0)"
  ink: "oklch(25% 0.028 244)"
  muted: "oklch(46% 0.025 244)"
  line: "oklch(84.5% 0.02 244)"
  control-line: "oklch(62% 0.03 244)"
  primary: "oklch(45% 0.075 244)"
  primary-deep: "oklch(30% 0.045 244)"
  primary-soft: "oklch(90.5% 0.03 244)"
  success: "oklch(51% 0.065 160)"
  warning: "oklch(56% 0.07 78)"
  danger: "oklch(49% 0.085 30)"
typography:
  display:
    fontFamily: "Georgia, Noto Serif TC, serif"
    fontSize: "68px"
    fontWeight: 500
    lineHeight: 1.09
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
  lg: "10px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-raised}"
    rounded: "{rounded.md}"
    padding: "0 15px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "0 15px"
    height: "40px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "18px 22px"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "43px"
---

# Design System: 家計值班

## 1. Overview

**Creative North Star: "晨霧值班台"**

家計值班像清晨微霧中的家庭工作桌：安靜、有秩序，重要訊息能被看見，但不以刺眼顏色製造焦慮。視覺採低彩度灰藍莫蘭迪色，資訊密度足以支援日常家計工作，同時保留清楚的呼吸空間。

介面禁止走向高飽和金融科技、暖奶油生活模板或遊戲化記帳。色彩服務於操作、狀態與資料分類，不是裝飾。

**Key Characteristics:**

- 灰藍中性底色與低彩度鋼藍主色
- 平面分層、細線分隔與短距離陰影
- 一致的語意狀態色與明確文字標籤
- 安靜的家庭語氣，不製造消費羞恥
- 桌面側欄與行動底部導覽共用同一視覺語彙

## 2. Colors

主色是低彩度鋼藍，背景與文字都朝同一灰藍色相輕微偏移；成功、警告與危險色只在狀態上使用。

### Primary

- **值班鋼藍:** 主要按鈕、目前選取項目、連結、圖表主序列。
- **深霧藍:** 側欄、電子發票流程區與 Toast。
- **薄霧藍:** 選取摘要、標籤與自動入帳狀態。

### Secondary

- **低彩度鼠尾草:** 成功與連線正常。
- **霧面赭黃:** 待處理、即將到期與同步警告。
- **柔和陶紅:** 錯誤與真正需要處理的異常。

### Neutral

- **晨霧底:** 全站畫布。
- **霧白表面:** 面板、表單與資料區。
- **墨藍灰:** 主要文字。
- **石板灰藍:** 次要說明。
- **冷霧線:** 邊框、分隔與表格線。

### Named Rules

**The Ten Percent Rule.** 主色只用在主要操作、目前選取與關鍵資料，不把所有標題都染藍。

**The Semantic Color Rule.** 綠只代表正常、黃只代表待處理、紅只代表錯誤，而且每次都搭配文字或圖示。

## 3. Typography

**Display Font:** Georgia（搭配 Noto Serif TC）

**Body Font:** Noto Sans TC（搭配 PingFang TC 與 Microsoft JhengHei）

**Character:** 標題保留家庭帳本的沉穩感，操作文字則維持高辨識度與熟悉的系統介面節奏。

### Hierarchy

- **Display**（500，最高 68px，1.09）：只用於首頁問候主標。
- **Headline**（500，20–42px，1.2）：區塊標題與自動化說明。
- **Title**（600，13–17px，1.4）：帳單、提醒與空狀態。
- **Body**（400，15px，1.5）：一般說明，長文限制約 70ch。
- **Label**（700，8–12px）：狀態、資料標籤與按鈕；英文短標籤可有限度使用大寫。

### Named Rules

**The Two-Family Rule.** 全站最多使用一組襯線標題與一組無襯線介面文字，不增加第三種字體。

## 4. Elevation

以色面與邊線分層為主。一般面板保持平面；有邊框的元件只允許短距離、最高 8px 模糊的環境陰影。Modal 可使用較深陰影與背景遮罩，因為它代表真正的互動層級。

### Shadow Vocabulary

- **Ambient low**（0 3px 8px）：摘要卡與主要操作的輕微浮起。
- **Panel low**（0 2px 6px）：統計列，僅用來與畫布分開。
- **Modal**（0 24px 64px）：只用於 Modal。

### Named Rules

**The Flat-by-Default Rule.** 面板預設平面；若邊框已能表達邊界，就不得再加大面積柔焦陰影。

## 5. Components

### Buttons

- **Shape:** 輕微圓角（7–8px）。
- **Primary:** 值班鋼藍底、霧白字，40px 高。
- **Hover / Focus:** 150–200ms 狀態轉換；鍵盤焦點使用可見的鋼藍外環。
- **Secondary:** 霧白表面、冷霧線邊框與鋼藍文字。

### Chips

- **Style:** 低彩度色面搭配同色系深文字，3–4px 圓角。
- **State:** 必須帶文字，不能只靠背景色表達。

### Cards / Containers

- **Corner Style:** 4–10px；摘要卡可有一個稍大的特徵角，但禁止全面 24px 以上圓角。
- **Background:** 霧白表面或薄霧藍。
- **Shadow Strategy:** 依 Elevation 規則；一般面板不使用陰影。
- **Border:** 冷霧線完整包圍；互動控制項使用對比至少 3:1 的控制線，不使用彩色側邊條。
- **Internal Padding:** 18–24px。

### Inputs / Fields

- **Style:** 霧白底、1px 冷霧線與 4px 圓角。
- **Focus:** 鋼藍邊框與半透明 3px focus ring。
- **Error / Disabled:** 錯誤使用陶紅文字與柔和陶紅色面；disabled 降低對比但仍可讀。

### Navigation

深霧藍底配霧白文字。未選取項目使用可讀的灰藍文字；active 以完整低彩度色面標示，不使用左側或頂部彩色條。

### Household Status

狀態圓點只作為輔助，旁邊必須保留「已連線、等待憑證、待處理」等文字。黃色與紅色不可用於純裝飾。

## 6. Do's and Don'ts

### Do:

- **Do** 使用灰藍中性色面建立層次，再把鋼藍留給操作與選取狀態。
- **Do** 維持一般文字 4.5:1、互動元件 3:1 以上的對比。
- **Do** 讓所有狀態同時具有文字、圖示或形狀。
- **Do** 讓桌面與行動版共用相同的色彩語意。

### Don't:

- **Don't** 做「高飽和亮藍與霓虹漸層的金融科技儀表板」。
- **Don't** 做「暖米色、奶油紙張質感的生活風記帳模板」。
- **Don't** 用紅綠顏色單獨判斷好壞，也不要把消費遊戲化或製造羞恥感。
- **Don't** 堆疊玻璃卡片、超大圓角或無意義的裝飾動畫。
- **Don't** 在卡片上使用大於 1px 的彩色側邊條。
- **Don't** 同時使用 1px 邊框與 16px 以上模糊的裝飾陰影。
