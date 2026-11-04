"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const MINIMUM_MS = 1500;

/** Persists in the root layout: route changes never replay the launch screen. */
export function AppLaunchScreen({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "leaving" | "done">("loading");

  useEffect(() => {
    const root = content.current;
    if (!root) return;
    let disposed = false;
    let frame = 0;
    let finishTimer = 0;
    let finishing = false;
    let fontsReady = false;
    let artworkReady = false;
    let previous = 0;
    let readySince = 0;
    // Start from the first rendered frame, not navigationStart (which includes TTFB).
    const started = performance.now();
    const artwork = document.querySelector<HTMLImageElement>(".app-launch-art");
    const settleArtwork = () => { artworkReady = true; };
    if (!artwork || artwork.complete) artworkReady = true;
    artwork?.addEventListener("load", settleArtwork);
    artwork?.addEventListener("error", settleArtwork);
    void document.fonts.ready.then(() => { fontsReady = true; });
    const tick = (now: number) => {
      if (disposed) return;
      const pageReady = Boolean(root.querySelector("main, .next-error-h1")) && !root.querySelector("[data-app-loading]");
      const ready = pageReady && fontsReady && artworkReady;
      if (!ready) readySince = 0;
      else if (!readySince) readySince = now;
      // Preparation milestones, never a fabricated network/byte percentage.
      const milestone = 20 + (fontsReady ? 20 : 0) + (artworkReady ? 20 : 0) + (pageReady ? 35 : 0);
      const next = Math.max(previous, Math.min(milestone, Math.floor((now - started) / MINIMUM_MS * 95)));
      if (next !== previous) { previous = next; setProgress(next); }
      if (ready && now - readySince >= 80 && now - started >= MINIMUM_MS && !finishing) {
        finishing = true;
        setProgress(100);
        finishTimer = window.setTimeout(() => {
          setPhase("leaving");
          finishTimer = window.setTimeout(() => setPhase("done"), 220);
        }, 100);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(finishTimer);
      artwork?.removeEventListener("load", settleArtwork);
      artwork?.removeEventListener("error", settleArtwork);
    };
  }, []);

  return <>
    {phase !== "done" && <div className={`app-launch-screen${phase === "leaving" ? " is-leaving" : ""}`} aria-label="กำลังเตรียมแอป RouteRao">
      <div className="app-launch-brand"><img src="/routerao-logo-transparent-512.png" width="44" height="44" alt="" /><span>RouteRao<small>TRAVEL SMARTER TOGETHER</small></span></div>
      <div className="app-launch-center">
        <img className="app-launch-art" src="/images/routerao-launch.webp" width="512" height="512" alt="" fetchPriority="high" />
        <h1>ทุกทริปดี ๆ เริ่มที่นี่</h1><p>เตรียมพร้อมสำหรับการเดินทางของคุณ</p>
        <div className="app-launch-progress-copy"><span><i aria-hidden="true" />กำลังเตรียมแอป</span><strong>{progress}%</strong></div>
        <div className="app-launch-progress" role="progressbar" aria-label="ความคืบหน้าการเตรียมแอป" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
      </div>
      <small className="app-launch-footer">GOOD TRIPS, HAPPIER US</small>
    </div>}
    <div ref={content} className="app-launch-content" inert={phase === "loading"}>{children}</div>
  </>;
}
