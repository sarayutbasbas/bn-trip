export async function prepareTripPlanDownload(tripId: string, tripName: string) {
  const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}/export-plan`, { cache: "no-store" });
  if (!response.ok) throw new Error("เตรียมไฟล์ไม่สำเร็จ กรุณาลองใหม่");
  const blob = await response.blob();
  if (!blob.size || !blob.type.includes("spreadsheetml")) {
    throw new Error("ไฟล์แผนทริปไม่ถูกต้อง กรุณาลองใหม่");
  }
  const name = tripName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 100) || "trip";
  return new File([blob], `${name}-plan.xlsx`, { type: blob.type });
}

// Call from a fresh tap AFTER fetching: Safari may expire user activation
// while the workbook is being generated. Never navigate the app to the file.
export async function saveTripPlanDownload(file: File) {
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ files: [file] });
    return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Allow browsers enough time to consume the download URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
