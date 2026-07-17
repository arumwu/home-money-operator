import type { Metadata } from "next";
import { getChatGPTUser } from "./chatgpt-auth";
import { Dashboard } from "./Dashboard";
import { formatTaipeiDate } from "@/lib/finance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "家計值班｜家庭金錢提醒與自動記帳",
  description: "該繳的先提醒，花掉的自動記，家裡的錢一眼看清。",
};

export default async function Home() {
  const user = await getChatGPTUser();
  const date = formatTaipeiDate();
  const [, month, day] = date.split("-");
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][
    new Date(`${date}T12:00:00Z`).getUTCDay()
  ];
  return (
    <Dashboard
      initialName={user?.displayName ?? "家庭管理者"}
      briefingDate={`${Number(month)}月${Number(day)}日 星期${weekday}`}
    />
  );
}
