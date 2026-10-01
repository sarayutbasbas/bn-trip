"use client";

import { useEffect, useRef, useState } from "react";

export function AutoLoadMore({ loading, error, count, onLoad, retryLabel, fallbackLabel }: {
  loading: boolean;
  error: string;
  count: number;
  onLoad: () => Promise<void>;
  retryLabel: string;
  fallbackLabel: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const callback = useRef(onLoad);
  const [manual, setManual] = useState(false);
  useEffect(() => { callback.current = onLoad; }, [onLoad]);
  useEffect(() => {
    if (loading || error) return;
    if (!("IntersectionObserver" in window)) { setManual(true); return; }
    const node = sentinel.current;
    if (!node) return;
    let triggered = false;
    const observer = new IntersectionObserver(entries => {
      if (!triggered && entries.some(entry => entry.isIntersecting)) {
        triggered = true;
        observer.disconnect();
        void callback.current();
      }
    }, { rootMargin: "0px 0px 400px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, error, count]);
  return <div ref={sentinel} className="auto-load-more" aria-busy={loading}>
    {error ? <p role="alert">{error}</p> : null}
    {error || manual ? <button type="button" className="load-more-btn" disabled={loading} onClick={onLoad}>{error ? retryLabel : fallbackLabel}</button> : null}
  </div>;
}
