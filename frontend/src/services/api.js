export async function api(path, body, method) {
  const r = await fetch("/api" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error || "Unable to connect. Please try again.");
  return data;
}
export function uploadPDF(file, analysis, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    const data = new FormData();
    data.append("file", file);
    if (analysis) data.append("analysis", JSON.stringify(analysis));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 90));
    };
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status >= 400) reject(new Error(d.error || "Upload failed."));
        else resolve(d);
      } catch {
        reject(new Error("The upload could not be completed."));
      }
    };
    xhr.onerror = () =>
      reject(new Error("Connection interrupted. Please try again."));
    xhr.send(data);
  });
}
export async function analyzePDF(file, onProgress) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf-assets/pdf.worker.min.mjs";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: true,
    cMapUrl: "/pdf-assets/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdf-assets/standard_fonts/",
    wasmUrl: "/pdf-assets/wasm/",
  });
  let doc;
  try {
    doc = await task.promise;
    if (doc.numPages > 150)
      throw new Error("Please upload a PDF containing 1–150 pages.");
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      await page.render({
        canvasContext: ctx,
        viewport,
        background: "rgb(255,255,255)",
      }).promise;
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0,
        colored = 0;
      for (let k = 0; k < pixels.length; k += 4) {
        const lo = Math.min(pixels[k], pixels[k + 1], pixels[k + 2]),
          hi = Math.max(pixels[k], pixels[k + 1], pixels[k + 2]);
        if (lo < 245) {
          ink++;
          if (hi - lo > 25) colored++;
        }
      }
      pages.push({
        number: i,
        blank: ink === 0,
        color: colored > Math.max(3, (pixels.length / 4) * 0.0001),
        coverage: Math.round((ink / (pixels.length / 4)) * 100000) / 1000,
        width: Math.round(viewport.width * 2),
        height: Math.round(viewport.height * 2),
      });
      canvas.width = 0;
      page.cleanup();
      onProgress(Math.round((i / doc.numPages) * 60));
    }
    return {
      total_pages: pages.length,
      blank_pages: pages.filter((p) => p.blank).map((p) => p.number),
      color_pages: pages.filter((p) => p.color).map((p) => p.number),
      bw_pages: pages.filter((p) => !p.blank && !p.color).map((p) => p.number),
      pages,
      engine: "PDF.js · browser raster analysis",
      size: file.size,
    };
  } finally {
    await task.destroy();
  }
}
export const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);
export const number = (n) => new Intl.NumberFormat("en-IN").format(n || 0);
export const date = (s) =>
  new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const time = (s) =>
  new Date(s).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
export const humanMode = (m) =>
  ({ bw: "Black & white", color: "Color", auto: "Auto color" })[m] || m;
