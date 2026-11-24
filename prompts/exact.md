# AI Wrapped 2026 — Exact mode prompt

## Steps (about 5 minutes)
1. claude.ai on web or desktop → Settings → Privacy → Export data. Wait for the email.
2. Download only these files: `conversations-000.zip`, `projects-000.zip`, `design_chats-000.zip`, `claude_code_cloud-000.zip`.
   Do NOT upload `light_metadata` (it holds your email, phone and login IPs) or `frames` (your artifact files and media).
3. Open a new Claude chat, attach the 4 ZIPs, paste the prompt below.

## Prompt

```
Build my "AI Wrapped 2026" from the Claude data export ZIPs attached.

Use code (not memory or guessing) to unzip and compute these from conversations.json, using my local timezone: [YOUR TIMEZONE, e.g. Europe/Lisbon]
- chats started in 2026, my messages, Claude's messages
- active days, longest streak of consecutive days
- my messages per month, per hour of day, per weekday
- words I wrote, words Claude wrote (characters / 5.5), estimated visible tokens (characters / 4, including thinking)
- tool calls by type: web searches, code runs, files created, memory lookups
- languages I used (from my first message in each chat)
- longest chat (message count and title)
From the other ZIPs: number of projects, design chats, and scheduled routine runs.

Then read ONLY the chat titles and decide:
- personality: a 2–3 word AI-user archetype, plus one sentence why
- top 3 themes
- funniest ask (from a title)
- one word for my year

Privacy rules: everything must be safe to post publicly on LinkedIn. No names of people, no health, money, legal, family or job-rejection topics, no company names unless they are mine.

Reply with ONE JSON code block and nothing else, using these keys:
chats, your_messages, claude_messages, active_days, longest_streak_days, your_words, claude_words, est_tokens, web_searches, code_runs, files_created, by_month, by_hour, by_weekday, languages, longest_chat, projects, design_chats, scheduled_runs, personality, personality_why, top_themes, funniest_ask, one_word_year
```

Paste the JSON at barrosbuilds.com/wrapped/import to get your cards.
