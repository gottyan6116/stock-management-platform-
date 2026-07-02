import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/app-shell/AppProviders";

export const metadata: Metadata = {
  title: "StockScope",
  description: "日本株・米国株を横断する長期投資向け個人株価Webアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
