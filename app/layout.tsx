import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Editorial display face for oversized headings — the one place the brand
// gets to show personality. Variable weight/optical-size axis gives real
// headline character without a second font request.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

// Highly legible workhorse for body copy, UI labels, and findings — never
// the display face, which would hurt long-form readability.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Technical/diagnostic text — evidence strings, IDs, metrics, confidence
// scores — anywhere a reader should trust they're looking at raw data.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Grafter — Find what's holding your store back",
  description:
    "An evidence-led ecommerce audit that shows you what needs attention, why it matters, and what to fix first.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
