import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "357 성경읽기",
  description: "매일 20분 말씀과 동행하는 성경통독",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
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