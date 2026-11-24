// Unzips off the main thread so the page stays responsive on phones.
import { readExport, type NamedBlob } from "./zip";

interface WorkerScope {
  onmessage: ((e: MessageEvent<{ files: NamedBlob[] }>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}
const ctx = self as unknown as WorkerScope;

ctx.onmessage = async (e) => {
  try {
    const result = await readExport(e.data.files);
    const transfer = result.conversations ? [result.conversations.buffer as ArrayBuffer] : [];
    ctx.postMessage({ ok: true, result }, transfer);
  } catch (err) {
    ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
