"use client";

import JSZip from "jszip";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { type CardDef, StoryCard } from "@/components/cards/cards";
import { encodeShare, tokenFromInput } from "@/lib/share/codec";
import { cardFileName, cardToPng, saveBlob } from "@/lib/share/png";
import { BASE_PATH } from "@/lib/site";
import type { StoryEdits } from "@/lib/story/edits";
import type { CardStats } from "@/lib/story/schema";
import { THEMES } from "@/lib/story/theme";

interface Props {
  stats: CardStats;
  edits: StoryEdits;
  deck: CardDef[];
  index: number;
}

const canShareFiles = (): boolean => {
  try {
    const probe = new File([new Uint8Array(1)], "probe.png", { type: "image/png" });
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
};

export function SharePanel({ stats, edits, deck, index }: Props) {
  const router = useRouter();
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [friend, setFriend] = useState("");
  const shareable = useMemo(() => canShareFiles(), []);

  const token = useMemo(() => encodeShare(stats, edits), [stats, edits]);
  const link = `${location.origin}${BASE_PATH}/s#${token}`;
  const friendToken = tokenFromInput(friend);
  const theme = THEMES[edits.theme];

  const render = async (i: number): Promise<Blob> => {
    const node = refs.current[i]?.firstElementChild as HTMLElement | null;
    if (!node) throw new Error("card not ready");
    return cardToPng(node);
  };

  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await job();
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError("Couldn't make the image. Try again, or use another browser.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-testid="share-panel" className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold">Post the cards</h3>
        <p className="text-sm text-cream/80">
          Images are made right here in your browser at 1080×1350, the size LinkedIn and Instagram like.
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn
            testId="download-card"
            disabled={!!busy}
            onClick={() => run("card", async () => saveBlob(await render(index), cardFileName(index, deck[index].key)))}
          >
            {busy === "card" ? "Making image…" : `Download card ${index + 1}`}
          </Btn>
          <Btn
            testId="download-all"
            disabled={!!busy}
            onClick={() =>
              run("all", async () => {
                const zip = new JSZip();
                for (let i = 0; i < deck.length; i++) zip.file(cardFileName(i, deck[i].key), await render(i));
                saveBlob(await zip.generateAsync({ type: "blob" }), "ai-wrapped-2026.zip");
              })
            }
          >
            {busy === "all" ? `Making ${deck.length} images…` : `Download all ${deck.length} (.zip)`}
          </Btn>
          {shareable && (
            <Btn
              testId="share-image"
              disabled={!!busy}
              onClick={() =>
                run("share", async () => {
                  const file = new File([await render(index)], cardFileName(index, deck[index].key), {
                    type: "image/png",
                  });
                  await navigator.share({ files: [file], title: "My AI Wrapped 2026" });
                })
              }
            >
              Share image…
            </Btn>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-coral">
            {error}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold">Share your story as a link</h3>
        <p className="text-sm text-cream/80">
          Your stats travel in the link itself, after the <code>#</code>. Browsers never send that part to a server,
          so we never see it. Anyone you give the link to can, so share it where you&apos;d share the cards.
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            aria-label="Your share link"
            data-testid="share-url"
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 font-mono text-xs text-cream"
          />
          <Btn
            testId="copy-link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setError("Couldn't copy. Select the link and copy it yourself.");
              }
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Btn>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold">Prove it</h3>
        <p className="text-sm text-cream/80">Paste a friend&apos;s share link to see who wins each stat.</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (friendToken) router.push(`/vs#${friendToken}.${token}`);
          }}
        >
          <input
            value={friend}
            onChange={(e) => setFriend(e.target.value)}
            placeholder="https://www.barrosbuilds.com/wrapped/s#…"
            aria-label="Friend's share link"
            data-testid="friend-link"
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 font-mono text-xs text-cream"
          />
          <Btn testId="compare" disabled={!friendToken} type="submit">
            Compare
          </Btn>
        </form>
        {friend && !friendToken && <p className="text-sm text-coral">That doesn&apos;t look like a share link.</p>}
      </section>

      {/* Full-size copies of every card, off screen, used as the source for the images. */}
      <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
        {deck.map((c, i) => (
          <div
            key={c.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
          >
            <StoryCard def={c} n={i + 1} total={deck.length} s={stats} e={edits} t={theme} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Btn(props: {
  testId: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  children: React.ReactNode;
}) {
  return (
    <button
      type={props.type ?? "button"}
      data-testid={props.testId}
      onClick={props.onClick}
      disabled={props.disabled}
      className="shrink-0 rounded-full bg-amber px-4 py-2 font-mono text-sm font-medium text-ink hover:bg-amber-hi disabled:opacity-50"
    >
      {props.children}
    </button>
  );
}
