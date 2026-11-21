import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cubierto",
  description: "Panel de Cubierto para bares y restaurantes.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
