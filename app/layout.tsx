import type { Metadata } from "next";
import { WEDDING } from "@/lib/wedding";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

// Precisa ser absoluta: o WhatsApp e o Instagram não resolvem caminho relativo
// em og:image, e sem isso o preview do link sai sem foto.
const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://confirmacao-presenca-gabriel-leticia.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${WEDDING.couple} · ${WEDDING.date}`,
    template: `%s · ${WEDDING.couple}`,
  },
  description: `Vamos nos casar em ${WEDDING.date}, na ${WEDDING.venue}. Confirme sua presença e veja nossa lista de presentes.`,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: `Casamento ${WEDDING.couple}`,
    title: `${WEDDING.couple} · ${WEDDING.date}`,
    description: `Confirme sua presença e veja nossa lista de presentes.`,
    // A imagem em si é o arquivo app/opengraph-image.jpg — o Next monta as tags
    // sozinho a partir dele, inclusive largura, altura e o texto alternativo.
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
