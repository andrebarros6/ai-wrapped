"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveSession } from "@/lib/engine/session";
import { ImportError, parseImport } from "@/lib/import/parse";
import { FULL_PROMPT, LITE_PROMPT } from "@/lib/prompts.generated";
import { REPO_URL } from "@/lib/site";
import { clearEdits, sanitizeEdits, saveEdits } from "@/lib/story/edits";
import { toCardStats } from "@/lib/story/schema";

type Kit = "full" | "lite";

const KITS: Record<Kit, { title: string; blurb: string; steps: string[]; prompt: string; file: string }> = {
  full: {
    title: "Exact · about 5 minutes",
    blurb: "Claude runs a small script on your export and prints totals only: the same numbers as this site.",
    steps: [
      "On claude.ai: Settings → Privacy → Export data, then download conversations-000.zip (projects, design_chats and claude_code_cloud add more).",
      "Turn on Settings → Capabilities → Code execution and file creation.",
      "New chat: attach the ZIPs (never light_metadata), paste the prompt, and change YOUR/TIMEZONE to yours.",
    ],
    prompt: FULL_PROMPT,
    file: "full.md",
  },
  lite: {
    title: "Rough · 30 seconds",
    blurb:
      "No export. Claude or ChatGPT guesses your year from the chats it can search. It can't see chats inside Projects, regenerated replies or tool use, so expect numbers well off (often 30–60% low) and the wrong peak hour. Your cards will say ESTIMATED. For your real numbers, use Exact.",
    steps: ["Turn on chat-history search (memory) in Claude or ChatGPT.", "Paste the prompt in a new chat."],
    prompt: LITE_PROMPT,
    file: "lite.md",
  },
};

export function ImportPanel() {
  const router = useRouter();
  const [kit, setKit] = useState<Kit>("full");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const k = KITS[kit];

  const submit = () => {
    try {
      const imported = parseImport(text);
      saveSession(imported.split, imported.tz, imported.source);
      clearEdits();
      if (imported.edits.opener || imported.edits.prediction) {
        const stats = toCardStats({ ...imported.split.shareable, source: imported.source });
        saveEdits(sanitizeEdits(imported.edits, stats));
      }
      router.push("/story");
    } catch (err) {
      setError(err instanceof ImportError ? err.message : "Something went wrong reading that JSON.");
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex gap-2 font-mono text-sm">
          {(Object.keys(KITS) as Kit[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={kit === id}
              data-testid={`kit-${id}`}
              onClick={() => {
                setKit(id);
                setCopied(false);
              }}
              className={`rounded-full border px-4 py-2 ${kit === id ? "border-amber text-amber" : "border-line"}`}
            >
              {KITS[id].title}
            </button>
          ))}
        </div>
        <p className="text-cream/85">{k.blurb}</p>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-cream/80">
          {k.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
          <li>Copy the JSON Claude replies with and paste it below.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="copy-prompt"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(k.prompt);
                setCopied(true);
              } catch {
                setError("Couldn't copy. Open the prompt below and copy it yourself.");
              }
            }}
            className="rounded-full bg-amber px-5 py-2 font-mono text-sm font-medium text-ink hover:bg-amber-hi"
          >
            {copied ? "Copied ✓" : "Copy the prompt"}
          </button>
          <a href={`${REPO_URL}/blob/main/prompts/${k.file}`} className="font-mono text-sm">
            prompts/{k.file} on GitHub
          </a>
        </div>
        <details className="rounded-xl border border-line">
          <summary className="cursor-pointer px-4 py-2 font-mono text-sm text-amber">Read the prompt first</summary>
          <pre
            data-testid="prompt-text"
            className="max-h-96 overflow-auto px-4 pb-4 font-mono text-xs whitespace-pre-wrap text-cream/85"
          >
            {k.prompt}
          </pre>
        </details>
      </section>

      <section className="flex flex-col gap-3">
        <label htmlFor="import-json" className="font-display text-2xl font-bold">
          Paste Claude&apos;s reply
        </label>
        <textarea
          id="import-json"
          data-testid="import-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          rows={8}
          placeholder='{ "version": 1, "source": "full-prompt", ... }'
          className="w-full rounded-xl border border-line bg-panel p-4 font-mono text-xs text-cream"
        />
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            data-testid="import-submit"
            disabled={!text.trim()}
            onClick={submit}
            className="rounded-full bg-amber px-6 py-3 font-display text-lg font-bold text-ink hover:bg-amber-hi disabled:opacity-40"
          >
            Make my story →
          </button>
          <span className="text-sm text-muted">What you paste stays in this browser.</span>
        </div>
        {error && (
          <p role="alert" data-testid="import-error" className="text-coral">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
