-- 60_chats.sql: individual chats.
--   longest_chat  [message count, title] of the chat with most messages (ties: higher title wins, as
--                 Python's max() over (n, title) tuples). The title is LOCAL ONLY.
--   chat_titles   all non-empty titles in file order. LOCAL ONLY: used in the browser for opt-in
--                 suggestions, never part of a shared card or link.
SELECT json_object(
    'longest_chat', (
        SELECT json_array(n, name)
        FROM (
            SELECT c.chat_idx, c.name, count(m.msg_idx) AS n
            FROM chats c LEFT JOIN messages m USING (chat_idx)
            GROUP BY c.chat_idx, c.name
        )
        ORDER BY n DESC, name DESC
        LIMIT 1
    ),
    'chat_titles', coalesce(
        (SELECT to_json(list(name ORDER BY chat_idx)) FROM chats WHERE coalesce(name, '') <> ''),
        '[]'::JSON)
) AS j;
