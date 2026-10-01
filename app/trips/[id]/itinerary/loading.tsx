import { FetchSkeleton } from "@/src/components/fetch-skeleton";

export default function Loading() {
  return <div className="app-shell flow-shell"><main><FetchSkeleton rows={5} label="กำลังเปิดไทม์ไลน์" /></main></div>;
}
