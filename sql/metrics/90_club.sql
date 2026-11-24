-- 90_club.sql — your AI Club: the highest normalised score wins (ties: earlier club in this list).
-- v1 placeholder thresholds; recalibrate from the open Wall dataset.
--   Researchers  web searches per chat / 2.0
--   Builders     (files created + artifacts) per chat / 0.7
--   Coders       code runs per chat / 0.8
--   Night Shift  night_share / 0.15
--   Polyglots    languages used in 3+ chats / 3
--   Talkers      your messages per chat / 6
WITH
base AS (
    SELECT
        greatest(1, (SELECT count(*) FROM chats)) AS n,
        tool_cat(['search'])
            - (SELECT coalesce(sum(n), 0) FROM tool_counts WHERE tool_name = 'conversation_search') AS web,
        tool_cat(['create_file', 'write', 'present_files', 'senduserfile']) AS files_created,
        tool_cat(['bash']) AS code_runs,
        coalesce((SELECT artifacts FROM src_counts), 0) AS artifacts,
        (SELECT count(*) FROM human) AS hmsg,
        py_round((SELECT count(*) FROM human WHERE local_hour >= 22 OR local_hour < 5)
                 / greatest(1, (SELECT count(*) FROM human)), 3) AS night_share,
        (SELECT count(*) FROM (SELECT lang FROM chat_language GROUP BY lang HAVING count(*) >= 3)) AS langs3
),
scores AS (
    SELECT 1 AS ord, 'Researchers' AS club, web / n / 2.0 AS score FROM base
    UNION ALL SELECT 2, 'Builders', (files_created + artifacts) / n / 0.7 FROM base
    UNION ALL SELECT 3, 'Coders', code_runs / n / 0.8 FROM base
    UNION ALL SELECT 4, 'Night Shift', night_share / 0.15 FROM base
    UNION ALL SELECT 5, 'Polyglots', langs3 / 3 FROM base
    UNION ALL SELECT 6, 'Talkers', (hmsg / n) / 6 FROM base
)
SELECT json_object(
    'club',        (SELECT club FROM scores ORDER BY score DESC, ord ASC LIMIT 1),
    'club_scores', (SELECT json_obj(list({'k': club, 'v': py_round(score, 2)} ORDER BY ord)) FROM scores)
) AS j;
