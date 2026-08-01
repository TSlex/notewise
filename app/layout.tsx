import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://notewise-midi-trainer.taltech.chatgpt.site"),
  title: "Notewise — MIDI-тренажёр нот",
  description:
    "Чтение и расстановка нот, свободная игра и настраиваемый браузерный синтезатор для занятий с MIDI-клавиатурой.",
  openGraph: {
    title: "Notewise — MIDI-тренажёр нот",
    description:
      "Читай ноты, играй свободно и настраивай собственный звук с MIDI-клавиатурой.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1728,
        height: 911,
        alt: "Notewise — MIDI-тренажёр чтения нот",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Notewise — MIDI-тренажёр нот",
    description:
      "Читай ноты, играй свободно и настраивай собственный звук с MIDI-клавиатурой.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
