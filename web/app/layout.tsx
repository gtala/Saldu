import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AuthProvider } from "@/components/auth-provider";
import { isMultiUserAuthEnabled } from "@/lib/auth-mode";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Saldu — Gastos y patrimonio",
  description: "Dashboard personal (migración a Next.js)",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const multi = isMultiUserAuthEnabled();
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        {multi ? <AuthProvider>{children}</AuthProvider> : children}
        <Script
          src="https://dix.chat/widget.js"
          data-token="pk_0473d7ba19d7b924378a273123730ad7afdcd13b42b4c784"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
