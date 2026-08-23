import { readMrz, type MrzResult } from "./mrz";

/**
 * Reading the machine-readable zone off a photo, in the browser.
 *
 * Everything here runs on the customer's device. A passport photograph is the
 * most sensitive image this product handles, and the alternative design — post
 * it to a server, recognise it there — would mean a second copy of it in a
 * second place for no benefit the customer can see. The recogniser is
 * Tesseract compiled to WebAssembly, served from our own origin because the
 * content-security policy admits no other, and loaded only when somebody asks
 * for it: five megabytes that a customer who types their own details never
 * fetches.
 *
 * The output is not trusted. `readMrz` returns a result only when every ICAO
 * check digit agrees, so this module's contract is the same: a document, or
 * nothing. See `mrz.ts` for why that is the only safe setting.
 */

/** Where the vendored engine lives. See `public/ocr/` and `docs/decisions/0022`. */
const CORE = "/ocr/tesseract-core-simd-lstm.js";
const WORKER = "/ocr/worker.min.js";
const LANG_PATH = "/ocr";

/** The MRZ alphabet, and nothing else. */
const WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<";

/**
 * Working width for recognition.
 *
 * Tesseract wants roughly 30px of character height; an MRZ line on a passport
 * is about 1/25th of the page height, so a 1600px-wide page puts each character
 * in the right range. Phone cameras produce more than this and the extra pixels
 * only cost time; older phones produce less, and upscaling a blurred photo does
 * not invent detail, which is what the blur grading on the upload step is for.
 */
const WORK_WIDTH = 1600;

export type OcrOutcome =
  { ok: true; document: MrzResult } | { ok: false; reason: "no-zone" | "unsupported" | "failed" };

/** Feature detection, so a browser without the pieces says so instead of hanging. */
export function ocrSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof WebAssembly === "object" &&
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas !== "undefined"
  );
}

/**
 * Otsu's method: pick the threshold that best separates ink from paper.
 *
 * A fixed threshold fails on the two photographs people actually take — a
 * passport under a desk lamp and one in a dim hallway. Otsu chooses per image
 * from the histogram, which is the difference between reading the zone and
 * returning a black rectangle.
 */
function binarize(data: Uint8ClampedArray): void {
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    // Rec. 601 luma; the MRZ is black on off-white so hue carries nothing.
    const grey =
      (0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0)) | 0;
    data[i] = grey;
    data[i + 1] = grey;
    data[i + 2] = grey;
    histogram[grey] = (histogram[grey] ?? 0) + 1;
  }

  const total = data.length / 4;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * (histogram[i] ?? 0);

  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t += 1) {
    weightBackground += histogram[t] ?? 0;
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * (histogram[t] ?? 0);
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (variance > best) {
      best = variance;
      threshold = t;
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    const value = (data[i] ?? 0) > threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
}

/**
 * Draw a region of the source into a working canvas, binarized.
 *
 * `fromTop` selects a horizontal band as a fraction of the height. The zone is
 * at the foot of every document ICAO defines, so the band is tried first and
 * the whole page only if that finds nothing — cropping is what stops the
 * recogniser reading the holder's printed name and the page furniture and
 * handing back forty lines of noise.
 */
function render(bitmap: ImageBitmap, fromTop: number): OffscreenCanvas {
  const scale = WORK_WIDTH / bitmap.width;
  const width = WORK_WIDTH;
  const sourceY = Math.floor(bitmap.height * fromTop);
  const sourceHeight = bitmap.height - sourceY;
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, sourceY, bitmap.width, sourceHeight, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  binarize(image.data);
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Read a document photograph.
 *
 * Never throws. A recogniser that fails must leave the customer typing their
 * details, which is exactly where they were before they pressed the button.
 */
export async function readDocumentPhoto(file: Blob, now: Date = new Date()): Promise<OcrOutcome> {
  if (!ocrSupported()) return { ok: false, reason: "unsupported" };

  let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null = null;
  try {
    const bitmap = await createImageBitmap(file);
    const { createWorker, PSM } = await import("tesseract.js");

    worker = await createWorker(
      "eng",
      1,
      {
        corePath: CORE,
        workerPath: WORKER,
        langPath: LANG_PATH,
        // The default builds the worker from a blob: URL, which `worker-src
        // 'self'` refuses. Loading the script from our own origin keeps the
        // policy as it is rather than widening it for a convenience.
        workerBlobURL: false,
        gzip: true,
      },
      {
        // These are read once when the language is loaded; passing them to
        // `setParameters` later logs "can only be set during initialization" and
        // leaves the dictionaries on.
        load_system_dawg: "0",
        load_freq_dawg: "0",
        load_number_dawg: "0",
        load_punc_dawg: "0",
        load_unambig_dawg: "0",
        load_bigram_dawg: "0",
      },
    );

    await worker.setParameters({
      tessedit_char_whitelist: WHITELIST,
      // A block of uniform text: the zone is two or three lines of one size,
      // and letting Tesseract look for columns and paragraphs in it only gives
      // it ways to be wrong.
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "0",
    });

    // The bottom third first, then the whole page. Two passes on a phone is
    // about a second of extra work in the case that would otherwise fail.
    for (const fromTop of [0.62, 0]) {
      const canvas = render(bitmap, fromTop);
      const { data } = await worker.recognize(canvas);
      const document = readMrz(data.text ?? "", now);
      if (document) {
        bitmap.close();
        return { ok: true, document };
      }
    }

    bitmap.close();
    return { ok: false, reason: "no-zone" };
  } catch {
    return { ok: false, reason: "failed" };
  } finally {
    // Terminating releases the WebAssembly heap. Leaving it resident is tens of
    // megabytes on a phone that is about to be asked to take another photo.
    await worker?.terminate().catch(() => {});
  }
}
