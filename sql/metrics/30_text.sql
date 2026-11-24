-- 30_text.sql: words, tokens and tone.
--   your_words / claude_words  characters / 5.5 (your message text; Claude's text blocks)
--   est_tokens_visible         (your chars + Claude's text chars + thinking chars) / 4.
--                              Excludes tool results and system text, so it's a floor.
--   thinking_blocks            number of thinking blocks
--   thanks                     "thanks|thank you|obrigado/a|merci|gracias|danke" as whole words in your messages
--   em_dashes_from_claude      "—" in Claude's text blocks
--   retries                    sibling branches: for each (chat, parent, sender) with k>1 children, add k−1
--                              (edits + regenerations)
-- Characters are Unicode code points (DuckDB length() = Python len()).
WITH
chars AS (
    SELECT
        (SELECT coalesce(sum(length(msg_text)), 0) FROM human) AS hchars,
        (SELECT coalesce(sum(text_len), 0) FROM blocks
            WHERE block_type = 'text' AND sender IS DISTINCT FROM 'human') AS achars,
        (SELECT coalesce(sum(thinking_len), 0) FROM blocks WHERE block_type = 'thinking') AS tchars
),
-- Whole-word matching without lookarounds (RE2 has none): double every non-word character so
-- adjacent matches can each consume their own boundary. Word chars = letters, digits, "_",
-- like Python's Unicode \b. So "thank you" becomes "thank" + two spaces + "you".
thanks AS (
    SELECT coalesce(sum(len(regexp_extract_all(
        regexp_replace(lower(msg_text), '([^\pL\pN_])', '\1\1', 'g'),
        '(?:^|[^\pL\pN_])(thanks|thank  you|obrigad[oa]|merci|gracias|danke)(?:$|[^\pL\pN_])',
        1
    ))), 0) AS n
    FROM human
)
SELECT json_object(
    'est_tokens_visible',    (SELECT py_round0((hchars + achars + tchars) / 4) FROM chars),
    'your_words',            (SELECT py_round0(hchars / 5.5) FROM chars),
    'claude_words',          (SELECT py_round0(achars / 5.5) FROM chars),
    'thinking_blocks',       (SELECT count(*) FROM blocks WHERE block_type = 'thinking'),
    'thanks',                (SELECT n FROM thanks),
    'em_dashes_from_claude', (SELECT coalesce(sum(emdash_count), 0) FROM blocks
                                 WHERE block_type = 'text' AND sender IS DISTINCT FROM 'human'),
    'retries', (
        SELECT coalesce(sum(k - 1), 0)
        FROM (SELECT count(*) AS k FROM messages GROUP BY chat_uuid, parent_uuid, sender)
        WHERE k > 1
    )
) AS j;
