import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/app-shell/AppProviders";
import { PRODUCT } from "@/config/product";

export const metadata: Metadata = {
  title: PRODUCT.name,
  description: PRODUCT.description,
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
