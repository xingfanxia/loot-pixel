import type { Metadata, Viewport } from "next";
import { Silkscreen, VT323 } from "next/font/google";
import { DEFAULT_THEME, THEME_KEY, THEMES } from "@/lib/vault/themes";
import "./globals.css";
import "./themes/cyber.css";

const pixel = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-pixel",
});
/** DOM type for the cyber theme (a CRT terminal face) */
const term = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-term",
});

export const metadata: Metadata = {
  title: "Loot Pixel: the vault",
  description: "Hold to crack open a pixel-art loot card in a torch-lit vault. Collect the full set.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07060f",
  colorScheme: "dark",
};

// Applies ?theme= or the stored choice before first paint, so DOM styles don't flash the default theme.
const themeScript = `(function(){try{var ids=${JSON.stringify(THEMES.map((t) => t.id))},t=new URLSearchParams(location.search).get("theme")||localStorage.getItem(${JSON.stringify(THEME_KEY)});if(ids.indexOf(t)>=0)document.documentElement.setAttribute("data-vault-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${pixel.variable} ${term.variable}`} data-vault-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
