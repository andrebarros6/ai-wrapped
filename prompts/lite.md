# AI Wrapped 2026: lite prompt (30 seconds, rough estimates)

No export needed. Works in Claude or ChatGPT with chat-history search (memory) turned on.
It only sees part of your history: not chats inside Projects, not regenerated replies, not tool
use such as web searches, and only roughly when each message was sent. So the numbers are
**rough estimates**, often 30–60% low, and your cards will say ESTIMATED. For exact numbers,
use the export on the site, or `full.md`.

Paste the JSON it replies with at **barrosbuilds.com/wrapped/import**.

## Prompt

```
Look back through my past chats from 2026 using your chat history. Estimate my year and reply ONLY
with this JSON in one code block, filling in every value:

{
  "version": 1,
  "source": "lite-prompt",
  "platform": "Claude or ChatGPT",
  "chats": 0,
  "your_messages": 0,
  "active_days": 0,
  "web_searches": 0,
  "projects_total": 0,
  "night_share": 0.0,
  "languages": 1,
  "thanks": 0,
  "retries": 0,
  "by_hour": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "by_weekday": [0, 0, 0, 0, 0, 0, 0],
  "chattiest_day": {"date": "2026-MM-DD", "messages": 0, "topics": 0},
  "club": "one of: Researchers, Builders, Coders, Night Shift, Polyglots, Talkers",
  "opener": "my 2026 in one sentence, under 140 characters",
  "prediction": ["first playful line about my 2027", "second line", "third line"]
}

Definitions: chats = conversations I started in 2026; your_messages = messages I sent;
night_share = share of my messages sent between 22:00 and 05:00 (0 to 1); languages = how many
languages I chatted in; thanks = times I thanked you (thanks, thank you, obrigado, merci...);
retries = times I asked you to redo, retry or fix an answer; by_hour = 24 numbers, how many of
my messages fell in each hour from 00:00 to 23:00, my local time; by_weekday = 7 numbers, Monday
to Sunday; chattiest_day = the date I sent the most messages, how many, and how many different
topics that day; club = the one that fits me best (Researchers: most web searches,
Builders: most files and artifacts, Coders: most code runs, Night Shift: most messages after 10pm,
Polyglots: 3+ languages, Talkers: longest chats); prediction = each line completes the card's
heading "In 2027, you will...", so start with a verb ("Ship product #10, then start a list."),
not "You'll", and keep it under 60 characters or it gets cut.

Rules: everything must be safe to post publicly. No names of people, companies or places that
could identify me or anyone else, and no health, money, legal, family or job-rejection topics.
Where you can't count exactly, give your best estimate.
```
