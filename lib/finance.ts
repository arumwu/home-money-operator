const categoryRules: Array<[string, RegExp]> = [
  ["水電瓦斯", /台電|電費|自來水|水費|瓦斯|天然氣/i],
  ["食品雜貨", /全聯|家樂福|好市多|大潤發|超市|市場|食品|生鮮/i],
  ["餐飲", /餐廳|小吃|咖啡|麥當勞|星巴克|便當|飲料|早餐|火鍋/i],
  ["交通", /台鐵|高鐵|捷運|悠遊卡|計程車|uber|停車|加油|中油/i],
  ["醫療保健", /醫院|診所|藥局|牙醫|健保|康是美|屈臣氏/i],
  ["居家生活", /特力屋|宜得利|家具|家電|五金|清潔|生活百貨/i],
  ["通訊訂閱", /中華電信|台灣大哥大|遠傳|netflix|spotify|apple|google/i],
  ["教育", /書局|博客來|課程|學費|補習|文具/i],
  ["購物", /蝦皮|momo|pchome|百貨|服飾|鞋|網購/i],
];

export function categorize(merchant: string, itemNames: string[] = []) {
  const haystack = `${merchant} ${itemNames.join(" ")}`;
  for (const [category, pattern] of categoryRules) {
    if (pattern.test(haystack)) return { category, confidence: 0.92 };
  }
  return { category: "其他", confidence: 0.55 };
}

export function formatTaipeiDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function monthRange(date = new Date()) {
  const today = formatTaipeiDate(date);
  const start = `${today.slice(0, 7)}-01`;
  const next = new Date(`${start}T00:00:00+08:00`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { start, end: formatTaipeiDate(next) };
}
