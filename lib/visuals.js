import { promises as fs } from "node:fs";
import path from "node:path";

const MAX_VISUALS = 3;
const MAX_VISUAL_BYTES = 5 * 1024 * 1024;
const MIME_BY_EXTENSION = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};
const ACCEPTED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

function parseDataUrl(value) {
  const match = typeof value === "string" && value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) throw new Error("Visual data must be a PNG, JPEG, or WebP data URL.");
  const data = match[2].replace(/\s/g, "");
  return { mediaType: match[1].toLowerCase(), data };
}

function mimeFromPath(filePath) {
  const mediaType = MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()];
  if (!mediaType) throw new Error(`Unsupported visual file type for ${filePath}. Use PNG, JPEG, or WebP.`);
  return mediaType;
}

function describeVisual(visual, index) {
  const name = visual.label || visual.path || `Screenshot ${index + 1}`;
  return visual.viewport ? `${name} at ${visual.viewport}` : name;
}

async function prepareVisual(entry, rootDir, index) {
  const visual = typeof entry === "string" ? { path: entry } : entry;
  if (!visual || typeof visual !== "object") throw new Error("Each visual must be an image path or an object.");

  let mediaType;
  let data;
  if (visual.data !== undefined) {
    if (typeof visual.data !== "string" || visual.data.length === 0) {
      throw new Error("Visual data must be a non-empty base64 string or data URL.");
    }
    const parsed = visual.data.startsWith("data:")
      ? parseDataUrl(visual.data)
      : { mediaType: visual.mediaType, data: visual.data };
    mediaType = parsed.mediaType;
    data = parsed.data;
    if (!ACCEPTED_MIME_TYPES.has(mediaType)) throw new Error("Visual mediaType must be image/jpeg, image/png, or image/webp.");
  } else {
    if (!visual.path) throw new Error("Each visual needs a path or data URL.");
    const absolutePath = path.resolve(rootDir, visual.path);
    mediaType = mimeFromPath(visual.path);
    const image = await fs.readFile(absolutePath);
    if (image.byteLength > MAX_VISUAL_BYTES) throw new Error(`Visual ${visual.path} exceeds the 5 MB limit.`);
    data = image.toString("base64");
  }

  const bytes = Buffer.byteLength(data, "base64");
  if (bytes > MAX_VISUAL_BYTES) throw new Error(`Visual ${visual.path || index + 1} exceeds the 5 MB limit.`);
  const prepared = {
    path: visual.path || `screenshot-${index + 1}`,
    label: visual.label || null,
    viewport: visual.viewport || null,
    mediaType,
    data
  };
  return { ...prepared, description: describeVisual(prepared, index) };
}

export async function prepareVisuals(visuals = [], rootDir = process.cwd()) {
  if (!visuals) return [];
  if (!Array.isArray(visuals)) throw new Error("visuals must be an array.");
  if (visuals.length > MAX_VISUALS) throw new Error(`Polish reviews at most ${MAX_VISUALS} visuals at a time.`);
  return Promise.all(visuals.map((visual, index) => prepareVisual(visual, rootDir, index)));
}

export function renderVisualSummary(visuals = []) {
  if (visuals.length === 0) return "No rendered screenshots were supplied.";
  return visuals.map((visual, index) => `${index + 1}. ${visual.description}`).join("\n");
}
