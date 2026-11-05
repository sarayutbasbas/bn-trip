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
import { AppGlassScene } from "@/src/components/app-glass-scene";
import { PwaRuntime } from "@/src/components/pwa-runtime";
import { GlobalFormValidationDialog } from "@/src/components/form-error-dialog";
import { AppLaunchScreen } from "@/src/components/app-launch-screen";
import { appLaunchStyle } from "@/src/lib/app-launch-style";
import { appStartupImages } from "@/src/lib/app-startup-images";

export const metadata: Metadata = {
  title: { default: "RouteRao", template: "%s · RouteRao" },
  description: "วางแผนทริป ตารางเที่ยว และค่าใช้จ่ายของเราในที่เดียว",
  applicationName: "RouteRao",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "RouteRao", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/routerao-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/routerao-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon-routerao.png", sizes: "180x180", type: "image/png" }],
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
      <head>
        <style dangerouslySetInnerHTML={{ __html: appLaunchStyle }} />
        <link rel="preload" as="image" href="/images/routerao-launch.webp" />
        {appStartupImages.map(([width, height, ratio]) => <link key={`${width}-${height}-${ratio}`} rel="apple-touch-startup-image" href={`/images/startup/${width * ratio}x${height * ratio}.jpg?v=2`} media={`(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`} />)}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppLaunchScreen><AppGlassScene>{children}</AppGlassScene></AppLaunchScreen>
        <GlobalFormValidationDialog />
        <PwaRuntime />
      </body>
    </html>
  );
}
