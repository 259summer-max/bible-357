import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "357 성경읽기",
  description: "매일 20분 말씀과 동행하는 성경통독",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png", // 아이폰 홈 화면 추가 시 적용될 로고
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}