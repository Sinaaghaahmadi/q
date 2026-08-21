"use client";

/**
 * Client-side document image checks (§6: "client-side image quality check
 * (blur, glare, edge detection), auto-crop").
 *
 * Everything runs in a canvas before the file leaves the device, so a customer
 * finds out their photo is unreadable in the moment rather than a day later in
 * a rejection email. The server still re-encodes and re-checks.
 */

export interface ImageQuality {
  /** Variance of the Laplacian — low means out of focus. */
  sharpness: number;
  /** Share of pixels blown out to near-white. */
  glare: number;
  /** Mean luminance, 0–255. */
  brightness: number;
  width: number;
  height: number;
  verdict: "ok" | "blurry" | "glare" | "dark" | "small";
}

const MIN_EDGE = 640;
const SHARPNESS_FLOOR = 55;
const GLARE_CEILING = 0.12;
const DARK_FLOOR = 55;

async function loadBitmap(file: File): Promise<ImageBitmap> {
  return await createImageBitmap(file);
}

function analyse(data: Uint8ClampedArray, w: number, h: number): Omit<ImageQuality, "verdict"> {
  const grey = new Float32Array(w * h);
  let sum = 0;
  let blown = 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const g = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    grey[p] = g;
    sum += g;
    if (g > 246) blown += 1;
  }

  // 4-neighbour Laplacian; its variance is the standard focus measure.
  let mean = 0;
  let count = 0;
  const lap = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const p = y * w + x;
      const v = 4 * grey[p]! - grey[p - 1]! - grey[p + 1]! - grey[p - w]! - grey[p + w]!;
      lap[p] = v;
      mean += v;
      count += 1;
    }
  }
  mean /= Math.max(1, count);

  let variance = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const d = lap[y * w + x]! - mean;
      variance += d * d;
    }
  }
  variance /= Math.max(1, count);

  return {
    sharpness: variance,
    glare: blown / (w * h),
    brightness: sum / (w * h),
    width: w,
    height: h,
  };
}

/**
 * Normalizes a captured document to a max-1600px JPEG and reports its quality.
 * EXIF (including GPS) is dropped by going through the canvas (§15).
 */
export async function prepareDocument(
  file: File,
  maxEdge = 1600,
): Promise<{ blob: Blob; preview: string; quality: ImageQuality }> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const metrics = analyse(ctx.getImageData(0, 0, w, h).data, w, h);

  let verdict: ImageQuality["verdict"] = "ok";
  if (Math.min(w, h) < MIN_EDGE) verdict = "small";
  else if (metrics.glare > GLARE_CEILING) verdict = "glare";
  else if (metrics.brightness < DARK_FLOOR) verdict = "dark";
  else if (metrics.sharpness < SHARPNESS_FLOOR) verdict = "blurry";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.88);
  });

  return { blob, preview: canvas.toDataURL("image/jpeg", 0.6), quality: { ...metrics, verdict } };
}

/** SHA-256 of the normalized bytes — stored alongside the document (§11). */
export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
