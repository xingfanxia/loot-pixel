import type { Metadata, Viewport } from "next";
import { Silkscreen } from "next/font/google";
import "./globals.css";

const pixel = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-pixel",
});

export const metadata: Metadata = {
  title: "Loot Pixel: the vault",
  description: "Hold to crack open a pixel-art loot card in a torch-lit vault. Collect all nine.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07060f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={pixel.variable}>
      <body>{children}</body>
    </html>
  );
}
