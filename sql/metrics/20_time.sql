-- 20_time.sql: when you talk to Claude. All times are local (user's timezone), human messages only.
--   active_days                      distinct local dates with at least one message
--   longest_streak_days              longest run of consecutive active dates (1 if none, as in v0)
--   by_month / by_hour / by_weekday  message counts
--   avg_messages_per_active_day      your_messages / active_days, 1 decimal
--   night_share                      share sent 22:00–04:59, 3 decimals
--   weekend_share                    share sent Sat/Sun, 3 decimals
--   chattiest_day                    date with most messages (ties: the one reached first),
--                                    its message count, and distinct chat titles that day
--   chattiest_day_titles             the titles of that day's chats, in order. LOCAL ONLY: used for
--                                    opt-in, user-confirmed card text; never shared. (Not in v0.)
WITH
days AS (SELECT DISTINCT local_date FROM human),
islands AS (
    SELECT local_date - CAST(row_number() OVER (ORDER BY local_date) AS INTEGER) AS grp FROM days
),
per_day AS (
    SELECT h.local_date, count(*) AS n, min(ord3(h.chat_idx, h.msg_idx, 0)) AS first_seen,
           count(DISTINCT coalesce(c.name, '')) AS topics
    FROM human h JOIN chats c USING (chat_idx)
    GROUP BY h.local_date
),
top_day AS (
    SELECT local_date, n, topics FROM per_day ORDER BY n DESC, first_seen ASC LIMIT 1
),
top_day_titles AS (
    SELECT c.name, min(ord3(h.chat_idx, h.msg_idx, 0)) AS first_seen
    FROM human h JOIN chats c USING (chat_idx)
    WHERE h.local_date = (SELECT local_date FROM top_day) AND coalesce(c.name, '') <> ''
    GROUP BY c.name
),
totals AS (
    SELECT count(*) AS hmsg,
           count(*) FILTER (WHERE local_hour >= 22 OR local_hour < 5) AS night,
           count(*) FILTER (WHERE local_weekday IN ('Sat', 'Sun')) AS weekend
    FROM human
)
SELECT json_object(
    'active_days',         (SELECT count(*) FROM days),
    'longest_streak_days', (SELECT coalesce(max(n), 1) FROM (SELECT count(*) AS n FROM islands GROUP BY grp)),
    'by_month', coalesce((
        SELECT json_obj(list({'k': strftime(make_date(2026, m, 1), '%b'), 'v': n} ORDER BY m))
        FROM (SELECT local_month AS m, count(*) AS n FROM human GROUP BY 1)
    ), '{}'::JSON),
    'by_hour', coalesce((
        SELECT json_obj(list({'k': CAST(h AS VARCHAR), 'v': n} ORDER BY h))
        FROM (SELECT local_hour AS h, count(*) AS n FROM human GROUP BY 1)
    ), '{}'::JSON),
    'by_weekday', coalesce((
        SELECT json_obj(list({'k': wd, 'v': n} ORDER BY first_seen))
        FROM (SELECT local_weekday AS wd, count(*) AS n, min(ord3(chat_idx, msg_idx, 0)) AS first_seen
              FROM human GROUP BY 1)
    ), '{}'::JSON),
    'avg_messages_per_active_day',
        py_round((SELECT hmsg FROM totals) / greatest(1, (SELECT count(*) FROM days)), 1),
    'night_share',   py_round((SELECT night FROM totals) / greatest(1, (SELECT hmsg FROM totals)), 3),
    'weekend_share', py_round((SELECT weekend FROM totals) / greatest(1, (SELECT hmsg FROM totals)), 3),
    'chattiest_day', (
        SELECT json_object('date', strftime(local_date, '%Y-%m-%d'), 'messages', n, 'topics', topics)
        FROM top_day
    ),
    'chattiest_day_titles', coalesce(
        (SELECT to_json(list(name ORDER BY first_seen)) FROM top_day_titles), '[]'::JSON)
) AS j;
