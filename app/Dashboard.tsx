"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type DashboardData = {
  identity: { email: string; displayName: string; role: "owner" | "viewer" };
  stats: {
    monthlySpend: number;
    upcomingBills: number;
    automationRate: number;
    importedThisMonth: number;
  };
  categories: Array<{ category: string; amount: number }>;
  recent: Array<{
    id: number;
    occurredAt: string;
    merchant: string;
    description: string | null;
    amount: number;
    category: string;
    source: string;
  }>;
  upcoming: Array<{
    id: number;
    name: string;
    provider: string | null;
    amount: number | null;
    nextDueDate: string;
    autopay: boolean;
    category: string;
  }>;
  alerts: Array<{
    id: number | string;
    kind: string;
    severity: string;
    title: string;
    message: string;
    createdAt: string;
  }>;
  gmail:
    | { connected: false }
    | {
        connected: true;
        address: string;
        status: string;
        lastSyncedAt: string | null;
        watchExpiration: string | null;
        lastError: string | null;
      };
  environment: {
    clientConfigured: boolean;
    encryptionConfigured: boolean;
    pubsubConfigured: boolean;
  };
  imports: Record<string, number>;
};

const emptyData = (name: string): DashboardData => ({
  identity: { email: "", displayName: name, role: "owner" },
  stats: { monthlySpend: 0, upcomingBills: 0, automationRate: 0, importedThisMonth: 0 },
  categories: [],
  recent: [],
  upcoming: [],
  alerts: [],
  gmail: { connected: false },
  environment: { clientConfigured: false, encryptionConfigured: false, pubsubConfigured: false },
  imports: {},
});

const currency = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

const compactDate = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  month: "short",
  day: "numeric",
});

function timeAgo(value: string | null) {
  if (!value) return "尚未同步";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "剛剛同步";
  if (minutes < 60) return `${minutes} 分鐘前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小時前`;
  return `${Math.floor(minutes / 1440)} 天前`;
}

function Icon({ name }: { name: "home" | "bill" | "chart" | "mail" | "alert" | "plus" | "sync" }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></>,
    bill: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    alert: <><path d="M12 3 2.5 20h19Z"/><path d="M12 9v4M12 17h.01"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    sync: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.5-2L20 8M4 16l2.4 2a7 7 0 0 0 11.5-2"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function StatusDot({ tone = "green" }: { tone?: "green" | "amber" | "muted" }) {
  return <span className={`status-dot ${tone}`} aria-hidden="true" />;
}

export function Dashboard({
  initialName,
  briefingDate,
}: {
  initialName: string;
  briefingDate: string;
}) {
  const [data, setData] = useState<DashboardData>(() => emptyData(initialName));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showBillForm, setShowBillForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const result = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "讀取家庭資料失敗");
      setData(result);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "讀取家庭資料失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const syncGmail = useCallback(async (silent = false) => {
    if (syncing) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/gmail/sync", { method: "POST" });
      const result = (await response.json()) as {
        error?: string;
        invoices?: number;
        duplicates?: number;
      };
      if (!response.ok) throw new Error(result.error ?? "Gmail 同步失敗");
      if (!silent) {
        setToast(`同步完成：新增 ${result.invoices ?? 0} 張，略過 ${result.duplicates ?? 0} 張重複發票`);
      }
      await load();
    } catch (syncError) {
      if (!silent) setToast(syncError instanceof Error ? syncError.message : "Gmail 同步失敗");
    } finally {
      setSyncing(false);
    }
  }, [load, syncing]);

  useEffect(() => {
    if (!data.gmail.connected || data.identity.role !== "owner") return;
    const lastSync = data.gmail.lastSyncedAt ? new Date(data.gmail.lastSyncedAt).getTime() : 0;
    const initialTimer = window.setTimeout(() => {
      if (Date.now() - lastSync > 30 * 60_000) void syncGmail(true);
    }, 0);
    const intervalTimer = window.setInterval(() => void syncGmail(true), 30 * 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, [data.gmail, data.identity.role, syncGmail]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const maxCategory = useMemo(
    () => Math.max(...data.categories.map((category) => category.amount), 1),
    [data.categories],
  );
  const isOwner = data.identity.role === "owner";
  const gmailReady = data.environment.clientConfigured && data.environment.encryptionConfigured;

  async function saveBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/bills", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        provider: form.get("provider"),
        amount: form.get("amount") ? Number(form.get("amount")) : null,
        nextDueDate: form.get("nextDueDate"),
        frequency: form.get("frequency"),
        autopay: form.get("autopay") === "on",
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setToast(result.error ?? "帳單建立失敗");
      return;
    }
    setShowBillForm(false);
    setToast("帳單提醒已加入值班表");
    await load();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="家計值班首頁">
          <span className="brand-mark"><span>家</span></span>
          <span><strong>家計值班</strong><small>HOME MONEY OPERATOR</small></span>
        </a>
        <nav aria-label="主要導覽">
          <a className="active" href="#overview"><Icon name="home" /><span>今日總覽</span></a>
          <a href="#bills"><Icon name="bill" /><span>帳單提醒</span></a>
          <a href="#spending"><Icon name="chart" /><span>收支統計</span></a>
          <a href="#automation"><Icon name="mail" /><span>電子發票</span></a>
          <a href="#alerts"><Icon name="alert" /><span>異常提醒</span></a>
        </nav>
        <div className="sidebar-status">
          <span><StatusDot tone={data.gmail.connected ? "green" : "amber"} />自動化值班</span>
          <strong>{data.gmail.connected ? "Gmail 已連線" : "等待 Gmail 憑證"}</strong>
          <small>所有敏感憑證只留在伺服器端</small>
        </div>
        <div className="profile-chip">
          <span className="avatar">{(data.identity.displayName || initialName).slice(0, 1)}</span>
          <span><strong>{data.identity.displayName || initialName}</strong><small>{isOwner ? "家庭管理者" : "唯讀檢視者"}</small></span>
        </div>
      </aside>

      <main id="top">
        <header className="topbar">
          <div><span className="eyebrow"><StatusDot />系統值班中</span><p>今天需要你處理的家計事項，都排在這裡。</p></div>
          <div className="top-actions">
            {data.gmail.connected && isOwner ? (
              <button className="button secondary" onClick={() => void syncGmail()} disabled={syncing}>
                <Icon name="sync" />{syncing ? "同步中…" : "同步 Gmail"}
              </button>
            ) : null}
            {isOwner ? <button className="button primary" onClick={() => setShowBillForm(true)}><Icon name="plus" />新增帳單</button> : null}
          </div>
        </header>

        <div className="content">
          {error ? <div className="notice error"><strong>資料庫尚未就緒</strong><span>{error}</span></div> : null}
          {!isOwner ? <div className="notice"><strong>唯讀檢視模式</strong><span>你可以查看家庭統計與提醒，但無法連接信箱或修改資料。</span></div> : null}

          <section id="overview" className="hero-row">
            <div>
              <span className="section-kicker">HOUSEHOLD BRIEFING · {briefingDate}</span>
              <h1>早安，家裡的錢<br/><em>目前都在掌握中。</em></h1>
              <p>該繳的先提醒，花掉的自動記，家裡的錢一眼看清。</p>
            </div>
            <div className="brief-card">
              <span>值班摘要</span>
              <strong>{data.stats.upcomingBills + data.alerts.length}</strong>
              <p>件需要留意</p>
              <small>{data.gmail.connected ? `電子發票 ${timeAgo(data.gmail.lastSyncedAt)}` : "連接 Gmail 後開始自動記帳"}</small>
            </div>
          </section>

          <section className="stat-grid" aria-label="本月摘要">
            <article><span className="stat-label">本月支出</span><strong>{currency.format(data.stats.monthlySpend)}</strong><small>{loading ? "載入中…" : "依已入帳交易統計"}</small></article>
            <article><span className="stat-label">30 天內待繳</span><strong>{data.stats.upcomingBills}<i> 件</i></strong><small>{data.stats.upcomingBills ? "最接近的帳單排在下方" : "目前沒有即將到期帳單"}</small></article>
            <article><span className="stat-label">自動記帳率</span><strong>{data.stats.automationRate}<i> %</i></strong><small>來自電子發票的交易比例</small></article>
            <article className="accent-stat"><span className="stat-label">本月電子發票</span><strong>{data.stats.importedThisMonth}<i> 張</i></strong><small>{data.gmail.connected ? `${timeAgo(data.gmail.lastSyncedAt)}更新` : "等待信箱連線"}</small></article>
          </section>

          <div className="dashboard-grid">
            <section id="bills" className="panel bills-panel">
              <div className="panel-heading"><div><span className="section-kicker">UPCOMING</span><h2>接下來要繳的</h2></div>{isOwner ? <button className="text-button" onClick={() => setShowBillForm(true)}>＋ 加一筆</button> : null}</div>
              {data.upcoming.length ? (
                <div className="bill-list">
                  {data.upcoming.map((bill) => (
                    <article key={bill.id}>
                      <div className="date-block"><strong>{compactDate.format(new Date(`${bill.nextDueDate}T00:00:00+08:00`)).split("月")[1]?.replace("日", "") ?? bill.nextDueDate.slice(-2)}</strong><span>{Number(bill.nextDueDate.slice(5, 7))}月</span></div>
                      <div className="bill-main"><strong>{bill.name}</strong><span>{bill.provider || bill.category}{bill.autopay ? " · 自動扣款" : " · 待繳"}</span></div>
                      <strong className="bill-amount">{bill.amount === null ? "金額未定" : currency.format(bill.amount)}</strong>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact"><span>尚未建立固定帳單</span><p>先加入水、電、瓦斯、網路或房貸，到期前會自動出現在值班表。</p>{isOwner ? <button className="button soft" onClick={() => setShowBillForm(true)}>建立第一筆提醒</button> : null}</div>
              )}
            </section>

            <section id="alerts" className="panel alert-panel">
              <div className="panel-heading"><div><span className="section-kicker">WATCHLIST</span><h2>值班提醒</h2></div><span className="count-badge">{data.alerts.length}</span></div>
              {data.alerts.length ? (
                <div className="alert-list">{data.alerts.slice(0, 4).map((alert) => <article key={alert.id}><span className={`alert-icon ${alert.severity}`}><Icon name="alert" /></span><div><strong>{alert.title}</strong><p>{alert.message}</p></div></article>)}</div>
              ) : (
                <div className="empty-state compact calm"><span>目前沒有異常</span><p>同一商家的金額明顯高於過去平均時，會在這裡提醒。</p></div>
              )}
            </section>
          </div>

          <div className="dashboard-grid lower-grid">
            <section id="spending" className="panel spending-panel">
              <div className="panel-heading"><div><span className="section-kicker">THIS MONTH</span><h2>錢花到哪裡</h2></div><span className="panel-note">自動分類，可再調整</span></div>
              {data.categories.length ? (
                <div className="category-list">{data.categories.slice(0, 6).map((category, index) => <article key={category.category}><span className={`category-swatch tone-${index % 6}`} /><strong>{category.category}</strong><div className="bar"><i style={{ width: `${Math.max(8, (category.amount / maxCategory) * 100)}%` }} /></div><span>{currency.format(category.amount)}</span></article>)}</div>
              ) : (
                <div className="empty-chart"><div className="empty-bars"><i/><i/><i/><i/><i/></div><p>電子發票入帳後，分類統計會自動長出來。</p></div>
              )}
            </section>

            <section className="panel recent-panel">
              <div className="panel-heading"><div><span className="section-kicker">LEDGER</span><h2>最近入帳</h2></div><span className="panel-note">{data.recent.length} 筆</span></div>
              {data.recent.length ? (
                <div className="transaction-list">{data.recent.slice(0, 6).map((transaction) => <article key={transaction.id}><span className="merchant-mark">{transaction.merchant.slice(0, 1)}</span><div><strong>{transaction.merchant}</strong><span>{transaction.category} · {compactDate.format(new Date(transaction.occurredAt))}</span></div><strong>{currency.format(transaction.amount)}</strong><small>{transaction.source === "einvoice" ? "自動" : "手動"}</small></article>)}</div>
              ) : (
                <div className="empty-state compact"><span>帳本還是空的</span><p>連接 Gmail 後，系統會掃描財政部附件並從第一張發票開始。</p></div>
              )}
            </section>
          </div>

          <section id="automation" className="automation-section">
            <div className="automation-copy">
              <span className="section-kicker light">AUTOMATION LINE</span>
              <h2>從財政部寄信，到家庭帳本<br/>整條流程自動值班。</h2>
              <p>Gmail 只授權唯讀範圍；refresh token 以伺服器端 AES-GCM 加密保存，不讀取、不修改其他信件。</p>
              <div className="gmail-card">
                <div className="gmail-logo">M</div>
                <div><strong>{data.gmail.connected ? data.gmail.address : "專用 Gmail 信箱"}</strong><span>{data.gmail.connected ? `${data.gmail.status === "connected" ? "連線正常" : "需要重新授權"} · ${timeAgo(data.gmail.lastSyncedAt)}` : gmailReady ? "OAuth 環境已就緒，等待授權" : "等待 Google OAuth 憑證"}</span></div>
                {isOwner ? (
                  data.gmail.connected ? <button className="button inverted" onClick={() => void syncGmail()} disabled={syncing}>{syncing ? "同步中…" : "立即同步"}</button> : gmailReady ? <a className="button inverted" href="/api/gmail/connect">連接 Gmail</a> : <button className="button inverted" disabled>待設定憑證</button>
                ) : <span className="viewer-badge">唯讀</span>}
              </div>
              {data.gmail.connected && "lastError" in data.gmail && data.gmail.lastError ? <p className="sync-warning">最近同步備註：{data.gmail.lastError}</p> : null}
            </div>
            <ol className="pipeline" aria-label="電子發票自動化流程">
              {[
                ["01", "財政部平台", "定期寄送消費資訊", data.gmail.connected ? "來源已對接" : "登入平台啟用寄送"],
                ["02", "Gmail OAuth", "唯讀接收 CSV／ZIP 附件", data.gmail.connected ? "已連線" : gmailReady ? "等待授權" : "等待憑證"],
                ["03", "雙重去重", "Gmail ID ＋ 附件 SHA-256", "已實作"],
                ["04", "解析分類", "商家、金額、品項與類別", "已實作"],
                ["05", "家庭帳本", "交易入帳與月度統計", "已實作"],
                ["06", "異常值班", "到期與高額消費提醒", "已實作"],
              ].map(([number, title, detail, status], index) => <li key={number}><span className="pipeline-number">{number}</span><div><strong>{title}</strong><p>{detail}</p></div><span className={`pipeline-status ${index < 2 && !data.gmail.connected ? "pending" : ""}`}>{status}</span></li>)}
            </ol>
          </section>

          <footer><span>家計值班 · Home Money Operator</span><p>資料以家庭私有空間保存 · Gmail 唯讀授權 · 支援唯讀檢視者</p></footer>
        </div>
      </main>

      {showBillForm ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowBillForm(false); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="bill-form-title">
            <button className="modal-close" onClick={() => setShowBillForm(false)} aria-label="關閉">×</button>
            <span className="section-kicker">NEW REMINDER</span><h2 id="bill-form-title">加入一筆家庭帳單</h2><p>水電、瓦斯、網路、房貸或訂閱都可以。</p>
            <form onSubmit={saveBill}>
              <label><span>帳單名稱</span><input required name="name" placeholder="例如：台電電費" maxLength={80}/></label>
              <label><span>服務商</span><input name="provider" placeholder="例如：台灣電力公司" maxLength={80}/></label>
              <div className="field-row"><label><span>預估金額</span><input name="amount" type="number" min="0" step="1" placeholder="可留空"/></label><label><span>下次到期日</span><input required name="nextDueDate" type="date"/></label></div>
              <label><span>重複週期</span><select name="frequency" defaultValue="monthly"><option value="once">只提醒一次</option><option value="monthly">每月</option><option value="bimonthly">每兩個月</option><option value="quarterly">每季</option><option value="yearly">每年</option></select></label>
              <label className="check-row"><input name="autopay" type="checkbox"/><span>已設定自動扣款（仍會提醒確認）</span></label>
              <button className="button primary full" type="submit">加入值班表</button>
            </form>
          </section>
        </div>
      ) : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}
