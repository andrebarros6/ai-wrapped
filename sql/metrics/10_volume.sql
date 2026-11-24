-- 10_volume.sql — how much you used Claude.
--   chats            conversations created in the year (user's timezone)
--   your_messages    messages you sent in those chats
--   claude_messages  messages from any other sender
--   files_uploaded   files + attachments on all messages
--   one_shot_chats   chats where you sent exactly one message
SELECT json_object(
    'chats',           (SELECT count(*) FROM chats),
    'your_messages',   (SELECT count(*) FROM messages WHERE sender = 'human'),
    'claude_messages', (SELECT count(*) FROM messages WHERE sender IS DISTINCT FROM 'human'),
    'files_uploaded',  (SELECT coalesce(sum(n_files), 0) FROM messages),
    'one_shot_chats',  (
        SELECT count(*) FROM (
            SELECT c.chat_idx FROM chats c LEFT JOIN human h USING (chat_idx)
            GROUP BY c.chat_idx HAVING count(h.chat_idx) = 1
        )
    )
) AS j;
