# AI Wrapped — Lite prompt (30 seconds, estimates)

Works in Claude or ChatGPT with chat history search turned on. It only sees a sample of chats (Claude: not inside Projects), so numbers are estimates. For exact numbers use the export.

```
Look back through my past chats from this year using your chat history. Build my "AI Wrapped" and reply ONLY with this JSON:
{
 "version": 1, "source": "lite-prompt",
 "platform": "Claude or ChatGPT",
 "chats_estimate": 0,
 "busiest_month": "",
 "top_themes": ["", "", ""],
 "club": "one of: Researchers, Builders, Coders, Night Shift, Polyglots, Talkers",
 "club_why": "one sentence",
 "night_share_estimate": 0.0,
 "languages": 0,
 "opener": "my year in one sentence",
 "prediction": "a playful one-line prediction for next year",
 "funniest_ask": "short and safe to post"
}
Rules: everything must be safe to post publicly. No names, health, money, legal, family or job-rejection topics. Where you can't count exactly, give your best estimate.
```

Paste the JSON at wrapped.barrosbuilds.com/lite.
