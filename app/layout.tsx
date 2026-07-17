import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "家計值班",
    template: "%s｜家計值班",
  },
  description: "該繳的先提醒，花掉的自動記，家裡的錢一眼看清。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "家計值班",
    description: "家庭金錢提醒、電子發票自動記帳與支出統計。",
    type: "website",
    images: [
      {
        url: "/home-money-social.png",
        width: 1200,
        height: 630,
        alt: "家計值班：家庭帳本、電子發票與金錢提醒",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "家計值班",
    description: "該繳的先提醒，花掉的自動記，家裡的錢一眼看清。",
    images: ["/home-money-social.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f0e7",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
