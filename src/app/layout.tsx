import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Spot NYC — Owner portal",
  description: "Private HubSpot view of deals and leads for The Spot NYC.",
  robots: { index: false, follow: false },
  icons: {
    icon: "https://images.squarespace-cdn.com/content/v1/697791ab0f8a700acb78090e/53660892-24a0-46a7-a013-fd118b5cd45e/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
