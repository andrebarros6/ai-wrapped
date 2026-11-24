-- 40_tools.sql: what Claude did for you (tool_use blocks).
-- Categories match on the lower-cased tool name containing a keyword:
--   web_searches       "search", minus conversation_search (that's memory, not the web)
--   code_runs          "bash"
--   files_created      "create_file", "write", "present_files", "senduserfile"
--   memory_lookups     "memory", "conversation_search", "recent_chats"
--   agent_style_chats  chats using any agent tool: Bash, Write, Edit, Read, SendUserFile, Artifact, TaskCreate
--   top_tools          8 most used tools as [name, count] (ties: first used first)
SELECT json_object(
    'tool_calls',     (SELECT coalesce(sum(n), 0) FROM tool_counts),
    'web_searches',   tool_cat(['search'])
                      - (SELECT coalesce(sum(n), 0) FROM tool_counts WHERE tool_name = 'conversation_search'),
    'code_runs',      tool_cat(['bash']),
    'files_created',  tool_cat(['create_file', 'write', 'present_files', 'senduserfile']),
    'memory_lookups', tool_cat(['memory', 'conversation_search', 'recent_chats']),
    'agent_style_chats', (
        SELECT count(DISTINCT chat_idx) FROM blocks
        WHERE block_type = 'tool_use'
          AND tool_name IN ('Bash', 'Write', 'Edit', 'Read', 'SendUserFile', 'Artifact', 'TaskCreate')
    ),
    'top_tools', coalesce((
        SELECT to_json(list(json_array(tool_name, n) ORDER BY n DESC, first_seen ASC))
        FROM (SELECT * FROM tool_counts ORDER BY n DESC, first_seen ASC LIMIT 8)
    ), '[]'::JSON)
) AS j;
