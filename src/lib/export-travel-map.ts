// Render a self-contained, light-themed PNG regardless of the app theme/zoom.
export async function exportTravelMap(svg: SVGSVGElement, title: string, summary: string[]) {
  await document.fonts.ready;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("viewBox", svg.dataset.exportViewbox || svg.getAttribute("viewBox")!);
  clone.setAttribute("width", "1080");
  clone.setAttribute("height", "780");
  clone.querySelectorAll("path,circle").forEach(element => {
    element.setAttribute("fill", element.classList.contains("is-visited") ? "#ff7518" : "#f7f2e8");
    element.setAttribute("stroke", "#788e99");
    element.setAttribute("stroke-width", "1");
    if (element.tagName === "circle") element.setAttribute("r", "5");
    element.removeAttribute("class");
  });
  // SVG images must be embedded before drawing onto a canvas (Safari included).
  for (const image of clone.querySelectorAll("image")) {
    const response = await fetch(image.getAttribute("href")!);
    if (!response.ok) throw new Error("โหลดภาพแผนที่ไม่สำเร็จ กรุณาลองอีกครั้ง");
    const blob = await response.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    image.setAttribute("href", data);
  }
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("สร้างรูปแผนที่ไม่สำเร็จ")); image.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1160 + summary.length * 42;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("อุปกรณ์นี้ไม่รองรับการบันทึกรูป");
    ctx.fillStyle = "#eaf8ff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ff6818";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("RouteRao · ความทรงจำของเรา", 60, 70);
    const font = getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = "#17243b";
    ctx.font = `bold 42px ${font}`;
    ctx.fillText(title, 60, 145);
    ctx.font = `28px ${font}`;
    summary.forEach((line, index) => ctx.fillText(line, 60, 202 + index * 42));
    const top = 240 + summary.length * 42;
    ctx.drawImage(image, 60, top, 1080, 780);
    ctx.fillStyle = "#ff7518";
    ctx.fillRect(60, top + 825, 22, 22);
    ctx.fillStyle = "#17243b";
    ctx.font = `24px ${font}`;
    ctx.fillText("ไปมาแล้ว", 95, top + 845);
    ctx.fillStyle = "#f7f2e8";
    ctx.fillRect(280, top + 825, 22, 22);
    ctx.strokeStyle = "#788e99";
    ctx.strokeRect(280, top + 825, 22, 22);
    ctx.fillStyle = "#17243b";
    ctx.fillText("ยังไม่ได้ไป", 315, top + 845);
    ctx.font = "18px sans-serif";
    ctx.fillText("Map data: Natural Earth · OpenStreetMap contributors · geoBoundaries", 60, top + 900);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("บันทึกรูปไม่สำเร็จ")), "image/png"));
    const downloadUrl = URL.createObjectURL(png);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "RouteRao-travel-map.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
  } finally { URL.revokeObjectURL(url); }
}
