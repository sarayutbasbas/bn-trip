import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-thai/thai-400.css";
import "@fontsource/ibm-plex-sans-thai/thai-500.css";
import "@fontsource/ibm-plex-sans-thai/thai-600.css";
import "@fontsource/ibm-plex-sans-thai/thai-700.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "./globals.css";
import { PwaRuntime } from "@/src/components/pwa-runtime";

export const metadata: Metadata = {
  title: { default: "Pack & Go+", template: "%s · Pack & Go+" },
  description: "วางแผนทริป ตารางเที่ยว และค่าใช้จ่ายของเราในที่เดียว",
  applicationName: "Pack & Go+",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Pack & Go+", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/pack-and-go-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pack-and-go-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon-pack-and-go.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ff7412" },
    { media: "(prefers-color-scheme: dark)", color: "#ff5a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeScript = `
  try {
    const saved = localStorage.getItem('bn-theme');
    const dark = saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', dark ? '#000000' : '#f2f2f7');
  } catch (_) {}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}<PwaRuntime/></body>
    </html>
  );
}
