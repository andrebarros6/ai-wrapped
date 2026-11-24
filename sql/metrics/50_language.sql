-- 50_language.sql — the languages and words you use.
--   languages_first_msg  chats per language (stop-word vote on your first message; see chat_language)
--   your_top_words       15 most frequent words (4+ letters, not stop words) in your messages under
--                        300 characters. Computed from the top 300 words, then filtered, as in v0.
--                        LOCAL ONLY: never part of a shared card or link.
WITH
lang_counts AS (
    SELECT lang, count(*) AS n, min(chat_idx) AS first_seen FROM chat_language GROUP BY lang
),
short_msgs AS (
    SELECT chat_idx, msg_idx, regexp_extract_all(lower(msg_text), '[a-zà-ú'']+') AS ws
    FROM human WHERE length(msg_text) < 300
),
word_rows AS (
    SELECT chat_idx, msg_idx, unnest(ws) AS w, generate_subscripts(ws, 1) AS wi FROM short_msgs
),
word_counts AS (
    SELECT w, count(*) AS n, min(ord3(chat_idx, msg_idx, wi)) AS first_seen FROM word_rows GROUP BY w
),
top300 AS (
    SELECT * FROM word_counts ORDER BY n DESC, first_seen ASC LIMIT 300
),
stop(w) AS (
    SELECT unnest([
        'que', 'de', 'a', 'o', 'e', 'the', 'to', 'and', 'i', 'é', 'do', 'da', 'em', 'um', 'para', 'of', 'in',
        'is', 'it', 'me', 'com', 'os', 'no', 'na', 'se', 'what', 'for', 'this', 'you', 'my', 'on', 'with', 'be',
        'as', 'that', 'la', 'le', 'les', 'des', 'et', 'en', 'un', 'une', 'du', 'eu', 'não', 'mas', 'uma', 'te',
        'can', 'are', 'an', 'or', 'if', 'so', 'at', 'by', 'have', 'how', 'also', 'all', 'just', 'we', 'from',
        'but', 'was', 'not', 'there', 'it''s', 'ao', 'há', 'mais', 'por', 'sobre', 'pelo', 'pela', 'ser', 'tem',
        'well', 'will', 'any', 'one', 'them', 'your', 'which', 'into', 'nos', 'esta', 'este', 'isso', 'como',
        'meu', 'minha', 'would', 'could', 'should', 'about', 'like', 'want', 'need', 'make', 'use', 'using'
    ])
),
top_words AS (
    SELECT * FROM top300
    WHERE w NOT IN (SELECT w FROM stop) AND length(w) > 3
    ORDER BY n DESC, first_seen ASC
    LIMIT 15
)
SELECT json_object(
    'languages_first_msg', coalesce(
        (SELECT json_obj(list({'k': lang, 'v': n} ORDER BY first_seen)) FROM lang_counts), '{}'::JSON),
    'your_top_words', coalesce(
        (SELECT to_json(list(w ORDER BY n DESC, first_seen ASC)) FROM top_words), '[]'::JSON)
) AS j;
