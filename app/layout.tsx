import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "非遗食谱 AI — 中国菜谱体验馆",
  description:
    "输入你冰箱里的食材，AI 为你生成中国八大菜系的精选菜谱、历史典故与养生智慧。千年传承，一菜一味。",
  keywords: [
    "Chinese cuisine",
    "AI recipe",
    "非遗食谱",
    "菜谱生成",
    "Chinese cooking",
    "八大菜系",
  ],
  openGraph: {
    title: "非遗食谱 AI — 中国菜谱体验馆",
    description: "千年传承，一菜一味。AI 为你生成中国八大菜系的精选菜谱。",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="dark">
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}
