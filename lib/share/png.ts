// Card images are made in the browser from the same markup shown on screen. No server involved.
import { toBlob } from "html-to-image";

export const PNG_W = 1080;
export const PNG_H = 1350;

export async function cardToPng(node: HTMLElement): Promise<Blob> {
  await document.fonts.ready;
  const options = { width: PNG_W, height: PNG_H, pixelRatio: 1, cacheBust: false };
  // The first render can miss web fonts that haven't been inlined yet; a second pass is reliable.
  await toBlob(node, options);
  const blob = await toBlob(node, options);
  if (!blob) throw new Error("could not render the card");
  return blob;
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const cardFileName = (index: number, key: string): string => `ai-wrapped-2026-${index + 1}-${key}.png`;
