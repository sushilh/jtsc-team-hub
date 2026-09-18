import type { Metadata, Viewport } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import "./globals.css";
import "./site-design.css";
import "./achievement-design.css";
import "./state-times-design.css";

const spaceGrotesk = Space_Grotesk({ variable: "--font-display", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://jtsc-team-hub.sushilh.workers.dev"),
  title: { default: "JTSC Team Hub", template: "%s · Jenks Trojan Swim Club" },
  description: "Volunteer check-in, meet administration, and swimmer achievement cards in one JTSC team hub.",
  openGraph: {
    title: "JTSC Team Hub",
    description: "Volunteer together. Celebrate every achievement.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "JTSC Achievement Card Studio" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = { themeColor: "#1a0a12", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${dmSans.variable}`}>{children}</body>
    </html>
  );
}
