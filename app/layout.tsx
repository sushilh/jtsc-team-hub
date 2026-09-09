import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Narrow } from "next/font/google";
import "./globals.css";
import "./site-design.css";

const archivo = Archivo({ variable: "--font-body", subsets: ["latin"] });
const archivoNarrow = Archivo_Narrow({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://jtsc-achievement-card-studio.lion-sushilh.chatgpt.site"),
  title: { default: "JTSC Team Hub", template: "%s · Jenks Trojan Swim Club" },
  description: "Volunteer check-in, meet administration, and swimmer achievement cards in one JTSC team hub.",
  openGraph: {
    title: "JTSC Team Hub",
    description: "Volunteer together. Celebrate every achievement.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "JTSC Achievement Card Studio" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = { themeColor: "#7d2248", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${archivoNarrow.variable}`}>{children}</body>
    </html>
  );
}
