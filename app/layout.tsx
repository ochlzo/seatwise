import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import StoreProvider from "./StoreProvider";
import SmoothScroll from "@/components/SmoothScroll";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://seatwiseapp.vercel.app"),
  title: {
    default: "Seatwise",
    template: "%s | Seatwise",
  },
  description:
    "Seatwise helps venues manage seating and events with speed, precision, and intelligence.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Seatwise",
    description:
      "Seatwise helps venues manage seating and events with speed, precision, and intelligence.",
    url: "https://seatwiseapp.vercel.app",
    siteName: "Seatwise",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Seatwise",
    description:
      "Seatwise helps venues manage seating and events with speed, precision, and intelligence.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}
      >
        <StoreProvider>
          <SmoothScroll>
            {children}
          </SmoothScroll>
        </StoreProvider>
      </body>
    </html>
  );
}
