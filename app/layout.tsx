import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "357 성경읽기",
  description: "매일 20분 말씀과 동행하는 성경통독",
  openGraph: {
    title: "153 성경읽기",
    description: "매일 20분 말씀과 동행하는 성경통독",
    url: "https://bible-357.vercel.app/",
    siteName: "153 성경읽기",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "교회 로고",
      },
    ],
    locale: "ko_KR",
    type: "website",
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