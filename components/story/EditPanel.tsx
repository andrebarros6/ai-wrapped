"use client";

import { useId, useState } from "react";

import { cleanTag, LIMITS, type StoryEdits } from "@/lib/story/edits";

interface Props {
  edits: StoryEdits;
  onChange: (next: StoryEdits) => void;
  onReset: () => void;
  /** Safe titles from the chattiest day. Only available on this device, right after analysing. */
  titleSuggestions: string[];
}

export function EditPanel({ edits, onChange, onReset, titleSuggestions }: Props) {
  const [suggest, setSuggest] = useState(false);
  const id = useId();
  const set = <K extends keyof StoryEdits>(key: K, value: StoryEdits[K]) => onChange({ ...edits, [key]: value });

  return (
    <form data-testid="edit-panel" className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
      <p className="text-sm text-cream/80">
        Everything here is printed on your cards. Nothing is shared until you choose to share.
      </p>

      <Field id={`${id}-name`} label="Your name (optional)" count={edits.display_name.length} max={LIMITS.display_name}>
        <input
          id={`${id}-name`}
          value={edits.display_name}
          maxLength={LIMITS.display_name}
          onChange={(e) => set("display_name", e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field id={`${id}-tag`} label="Group tag, e.g. your team or city (optional)" count={edits.tag.length} max={LIMITS.tag}>
        <div className="flex items-center gap-1">
          <span className="font-mono text-amber">#</span>
          <input
            id={`${id}-tag`}
            data-testid="tag-input"
            value={edits.tag}
            maxLength={LIMITS.tag + 1}
            onChange={(e) => set("tag", cleanTag(e.target.value, { typing: true }))}
            className={inputClass}
          />
        </div>
      </Field>

      <Field id={`${id}-opener`} label="Your year in one sentence" count={edits.opener.length} max={LIMITS.opener}>
        <textarea
          id={`${id}-opener`}
          data-testid="opener-input"
          value={edits.opener}
          maxLength={LIMITS.opener}
          rows={3}
          onChange={(e) => set("opener", e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field
        id={`${id}-example`}
        label="Chattiest day: what was it about? (optional)"
        count={edits.chattiest_day_example.length}
        max={LIMITS.chattiest_day_example}
      >
        <input
          id={`${id}-example`}
          data-testid="example-input"
          value={edits.chattiest_day_example}
          maxLength={LIMITS.chattiest_day_example}
          placeholder="e.g. From a pitch deck to a pasta recipe."
          onChange={(e) => set("chattiest_day_example", e.target.value)}
          className={inputClass}
        />
        {titleSuggestions.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-cream/80">
              <input
                type="checkbox"
                data-testid="suggest-toggle"
                checked={suggest}
                onChange={(e) => setSuggest(e.target.checked)}
              />
              Suggest from that day&apos;s chat titles (they never leave this device)
            </label>
            {suggest && (
              <div className="flex flex-wrap gap-2" data-testid="title-suggestions">
                {titleSuggestions.map((title) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => set("chattiest_day_example", title.slice(0, LIMITS.chattiest_day_example))}
                    className="rounded-full border border-line px-3 py-1 text-sm hover:border-amber"
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-mono text-sm text-muted">In 2027, you will…</legend>
        {edits.prediction.map((line, i) => (
          <input
            key={i}
            aria-label={`Prediction ${i + 1}`}
            value={line}
            maxLength={LIMITS.prediction}
            onChange={(e) => {
              const next = [...edits.prediction] as StoryEdits["prediction"];
              next[i] = e.target.value;
              set("prediction", next);
            }}
            className={inputClass}
          />
        ))}
      </fieldset>

      <button type="button" onClick={onReset} className="self-start font-mono text-sm text-muted underline">
        Reset to suggestions
      </button>
    </form>
  );
}

const inputClass = "w-full rounded-lg border border-line bg-ink px-3 py-2 text-cream";

function Field(props: { id: string; label: string; count: number; max: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between font-mono text-sm text-muted">
        <label htmlFor={props.id}>{props.label}</label>
        <span aria-hidden>
          {props.count}/{props.max}
        </span>
      </div>
      {props.children}
    </div>
  );
}
