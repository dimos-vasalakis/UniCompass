// Screenshots are resized in the browser before upload: a phone screenshot is
// several MB, but Claude only needs ~1568px on the long side to read it.
const MAX_SIDE = 1568;
const QUALITY = 0.85;

export type ListingImage = { media_type: "image/jpeg"; data_base64: string };

/** Downscale to MAX_SIDE and re-encode as JPEG; returns base64 without the data: prefix. */
export async function prepareImage(file: File): Promise<ListingImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#fff"; // transparent PNGs would turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  return { media_type: "image/jpeg", data_base64: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}
