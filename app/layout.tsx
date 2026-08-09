import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cosmos KP Builder",
  description: "Инструмент подготовки коммерческих предложений Cosmos Black Sea",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
