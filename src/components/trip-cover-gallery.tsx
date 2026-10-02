"use client";
import Image, { type ImageLoaderProps } from "next/image";
import { useRef, useState } from "react";
import { tripCovers, type CoverRecord } from "@/src/lib/trip-covers";

const privateCoverLoader = ({src,width,quality}: ImageLoaderProps) => `${src}${src.includes("?") ? "&" : "?"}w=${width}&q=${quality || 76}`;
const coverImageProps = (url: string) => ({ loader: url.startsWith("/api/uploads/") ? privateCoverLoader : undefined, unoptimized: !url.startsWith("/api/uploads/") });
export function TripCoverArt({ record, sizes, priority = false, className = "" }: { record: CoverRecord & { id: string; name: string }; sizes: string; priority?: boolean; className?: string }) {
  const urls = tripCovers(record);
  return <CardCoverSlider key={JSON.stringify([record.id, urls])} urls={urls} name={record.name} sizes={sizes} priority={priority} className={className} />;
}

function CardCoverSlider({ urls, name, sizes, priority, className }: { urls: string[]; name: string; sizes: string; priority: boolean; className: string }) {
  const track = useRef<HTMLDivElement>(null);
  const gesture = useRef({ x: 0, y: 0, moved: false });
  const [active, setActive] = useState(0);
  const [requested, setRequested] = useState<Set<number>>(() => new Set([0]));
  const requestSlide = (index: number) => setRequested(previous => previous.has(index) ? previous : new Set([...previous, index]));
  return <div className={`trip-cover-art ${className}`} onClick={(event) => {
    if (gesture.current.moved) { event.preventDefault(); event.stopPropagation(); return; }
    const link = event.currentTarget.closest("article")?.querySelector<HTMLButtonElement>(".trip-card-link, .compact-trip-link");
    if (link) { event.stopPropagation(); link.click(); }
  }}>
    <div ref={track} className="trip-cover-carousel" role="region" aria-label={`รูปปก ${name}`} onPointerDown={(event) => { gesture.current = { x: event.clientX, y: event.clientY, moved: false }; requestSlide(active + 1); requestSlide(active - 1); }} onPointerMove={(event) => {
      if (Math.abs(event.clientX - gesture.current.x) > 8 || Math.abs(event.clientY - gesture.current.y) > 8) gesture.current.moved = true;
    }} onPointerCancel={() => { gesture.current.moved = true; }} onScroll={(event) => {
      const node = event.currentTarget;
      const next = Math.max(0, Math.min(urls.length - 1, Math.round(node.scrollLeft / Math.max(1, node.clientWidth))));
      requestSlide(next);
      setActive(next);
    }}>
      {urls.map((url, index) => <div key={url} className="trip-cover-slide" role="group" aria-label={`รูปที่ ${index + 1} จาก ${urls.length}`}>{requested.has(index) && <Image src={url} alt={`รูปปก ${name} รูปที่ ${index + 1}`} fill sizes={sizes} priority={priority && index === 0} {...coverImageProps(url)} draggable={false} />}</div>)}
    </div>
    {urls.length > 1 && <div className="trip-cover-pagination" aria-label={`รูปที่ ${active + 1} จาก ${urls.length}`}>
      {urls.map((_, index) => <button key={index} type="button" aria-label={`ดูรูปที่ ${index + 1}`} aria-current={index === active ? "true" : undefined} onKeyDown={(event) => event.stopPropagation()} onClick={(event) => {
        event.preventDefault(); event.stopPropagation();
        requestSlide(index);
        track.current?.scrollTo({ left: index * track.current.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }}><span /></button>)}
    </div>}
  </div>;
}

export function TripCoverCarousel({ record }: { record: CoverRecord & { name: string } }) {
  const urls = tripCovers(record);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  return <>
    <div className="trip-detail-image-frame">
    <div ref={track} className="trip-cover-carousel" role="region" aria-label="รูปปกทริป" onScroll={(event) => {
      const node = event.currentTarget;
      const next = Math.max(0,Math.min(urls.length - 1,Math.round(node.scrollLeft / Math.max(1, node.clientWidth))));
      setActive((current) => current === next ? current : next);
    }}>
      {urls.map((url, index) => <div key={`${index}-${url}`} className="trip-cover-slide" role="group" aria-label={`รูปที่ ${index + 1} จาก ${urls.length}`}><Image src={url} alt={`รูปปก ${record.name} รูปที่ ${index + 1}`} fill sizes="100vw" priority={index === 0} {...coverImageProps(url)} draggable={false} /></div>)}
    </div>
    </div>
    {urls.length > 1 && <div className="trip-cover-pagination" aria-label={`รูปที่ ${active + 1} จาก ${urls.length}`}>
      {urls.map((_, index) => <button key={index} type="button" aria-label={`ดูรูปที่ ${index + 1}`} aria-current={index === active ? "true" : undefined} onClick={() => track.current?.scrollTo({ left: index * track.current.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}><span /></button>)}
    </div>}
  </>;
}
