-- 00_load.sql — builds the data model from a Claude export.
-- Runs unchanged in the browser (DuckDB-WASM) and in the CLI (Python duckdb).
--
-- Placeholders filled by the runner (validated before substitution):
--   {{conversations}}  quoted path/name of conversations.json
--   {{tz}}             IANA timezone, e.g. Europe/Lisbon
--   {{year}}           e.g. 2026
-- The runner also creates, before this file runs:
--   src_projects(created_at TIMESTAMPTZ)
--   src_design_chats(has_messages BOOLEAN, project_name VARCHAR, has_project BOOLEAN)
--   src_counts(artifacts INTEGER, scheduled_runs INTEGER)   -- scheduled_runs NULL when the file is absent

-- Python-compatible rounding (round half to even), so numbers match the v0 script.
CREATE OR REPLACE MACRO py_round(x, n) AS (
    CASE
        WHEN x * pow(10, n) - floor(x * pow(10, n)) > 0.5 THEN floor(x * pow(10, n)) + 1
        WHEN x * pow(10, n) - floor(x * pow(10, n)) < 0.5 THEN floor(x * pow(10, n))
        WHEN floor(x * pow(10, n)) % 2 = 0 THEN floor(x * pow(10, n))
        ELSE floor(x * pow(10, n)) + 1
    END / pow(10, n)
);
CREATE OR REPLACE MACRO py_round0(x) AS CAST(py_round(x, 0) AS BIGINT);

-- JSON object from an ordered list of {k, v} structs: json_obj(list({'k': key, 'v': val} ORDER BY ...)).
-- (json_group_object can't take ORDER BY, and key order is part of the output.)
CREATE OR REPLACE MACRO json_obj(entries) AS json(
    '{' || array_to_string(
        list_transform(coalesce(entries, []), e -> to_json(e.k)::VARCHAR || ':' || to_json(e.v)::VARCHAR), ','
    ) || '}'
);

-- Position in file order (chat, message, item). Python's Counter breaks ties by first-seen
-- order, so several metrics sort by this. Integer maths keeps it exact.
CREATE OR REPLACE MACRO ord3(a, b, c) AS
    CAST(a AS BIGINT) * 10000000000 + CAST(b AS BIGINT) * 100000 + CAST(c AS BIGINT);

-- Raw conversations, typed in one pass. Unknown keys are ignored, which is both
-- faster (~170x vs parsing JSON twice) and keeps us from loading fields we don't use.
CREATE OR REPLACE TABLE raw_chats AS
SELECT row_number() OVER () AS chat_idx, *
FROM read_json(
    {{conversations}},
    format = 'array',
    maximum_object_size = 1000000000,
    columns = {
        uuid: 'VARCHAR',
        name: 'VARCHAR',
        created_at: 'TIMESTAMPTZ',
        chat_messages: 'STRUCT(
            uuid VARCHAR, sender VARCHAR, created_at TIMESTAMPTZ, "text" VARCHAR,
            parent_message_uuid VARCHAR, files JSON[], attachments JSON[],
            content STRUCT("type" VARCHAR, "name" VARCHAR, "text" VARCHAR, thinking VARCHAR)[]
        )[]'
    }
);

-- Chats started in the year, in the user's timezone.
CREATE OR REPLACE TABLE chats AS
SELECT chat_idx, uuid, name, created_at, chat_messages
FROM raw_chats
WHERE year(created_at AT TIME ZONE '{{tz}}') = {{year}};

-- One row per message (all messages of those chats), with local-time fields.
CREATE OR REPLACE TABLE messages AS
SELECT
    chat_idx,
    chat_uuid,
    msg_idx,
    m.uuid,
    m.parent_message_uuid AS parent_uuid,
    m.sender,
    m.created_at AT TIME ZONE '{{tz}}' AS created_local,
    coalesce(m."text", '') AS msg_text,
    coalesce(len(m.files), 0) + coalesce(len(m.attachments), 0) AS n_files,
    m.content
FROM (
    SELECT chat_idx, uuid AS chat_uuid,
           unnest(chat_messages) AS m,
           generate_subscripts(chat_messages, 1) AS msg_idx
    FROM chats
);

-- One row per content block.
CREATE OR REPLACE TABLE blocks AS
SELECT
    chat_idx,
    chat_uuid,
    msg_idx,
    block_idx,
    sender,
    b."type" AS block_type,
    b."name" AS tool_name,
    length(coalesce(b."text", '')) AS text_len,
    length(coalesce(b."text", '')) - length(replace(coalesce(b."text", ''), '—', '')) AS emdash_count,
    length(coalesce(b.thinking, '')) AS thinking_len
FROM (
    SELECT chat_idx, chat_uuid, msg_idx, sender,
           unnest(content) AS b,
           generate_subscripts(content, 1) AS block_idx
    FROM messages
);

-- Human messages with the local-time fields most metrics need.
CREATE OR REPLACE VIEW human AS
SELECT
    *,
    CAST(created_local AS DATE) AS local_date,
    hour(created_local) AS local_hour,
    month(created_local) AS local_month,
    strftime(created_local, '%a') AS local_weekday
FROM messages
WHERE sender = 'human';

-- Tool usage, with first-seen order (Python's Counter breaks ties by insertion order).
CREATE OR REPLACE VIEW tool_counts AS
SELECT
    tool_name,
    count(*) AS n,
    min(ord3(chat_idx, msg_idx, block_idx)) AS first_seen
FROM blocks
WHERE block_type = 'tool_use'
GROUP BY tool_name;

-- Language of each chat: stop-word vote on your first non-empty message.
-- Ties go to the earlier language in this list (pt, fr, es, en), as in v0. Extend here.
CREATE OR REPLACE VIEW chat_language AS
WITH
firsts AS (
    SELECT chat_idx, arg_min(msg_text, msg_idx) AS first_text
    FROM human WHERE msg_text <> '' GROUP BY chat_idx
),
words AS (
    SELECT chat_idx, list_distinct(regexp_extract_all(lower(first_text), '[a-zà-ú]+')) AS ws FROM firsts
),
stopwords(lang, lang_ord, sw) AS (VALUES
    ('pt', 1, ['não', 'que', 'para', 'uma', 'como', 'está', 'você', 'tens', 'queres', 'obrigado', 'também', 'isso']),
    ('fr', 2, ['je', 'est', 'les', 'pour', 'une', 'pas', 'avec', 'vous', 'mon', 'dans', 'merci']),
    ('es', 3, ['que', 'para', 'una', 'pero', 'estoy', 'tengo', 'muy', 'gracias', 'también', 'hola']),
    ('en', 4, ['the', 'and', 'you', 'for', 'with', 'this', 'what', 'how', 'can', 'is', 'my'])
),
scored AS (
    SELECT chat_idx, lang, lang_ord, len(list_intersect(ws, sw)) AS score FROM words, stopwords
)
SELECT chat_idx, arg_min(lang, lang_ord) FILTER (WHERE score = best) AS lang
FROM (SELECT *, max(score) OVER (PARTITION BY chat_idx) AS best FROM scored)
WHERE best > 0
GROUP BY chat_idx;

-- Sum of tool calls whose lower-cased name contains any of the keywords.
CREATE OR REPLACE MACRO tool_cat(keywords) AS (
    SELECT coalesce(sum(n), 0)
    FROM tool_counts
    WHERE len(list_filter(keywords, k -> contains(lower(coalesce(tool_name, '')), k))) > 0
);
