-- 70_surfaces.sql — the rest of Claude, from the other export ZIPs (counts only).
--   design_chats            design chats (design_chats ZIP)
--   design_chats_with_msgs  design chats with at least one message
--   design_projects         distinct design projects
--   projects_total          projects (projects ZIP)
--   projects_created_<year> projects created in the year (user's timezone)
--   artifacts               artifact folders in the frames ZIP (names only; contents never opened)
--   scheduled_runs          scheduled task runs (claude_code_cloud ZIP); null if that ZIP is absent
SELECT json_object(
    'design_chats',           (SELECT count(*) FROM src_design_chats),
    'design_chats_with_msgs', (SELECT count(*) FROM src_design_chats WHERE has_messages),
    'design_projects',        (SELECT count(*) FROM (SELECT DISTINCT project_name FROM src_design_chats WHERE has_project)),
    'projects_total',         (SELECT count(*) FROM src_projects),
    'projects_created_' || {{year}},
        (SELECT count(*) FROM src_projects WHERE year(created_at AT TIME ZONE '{{tz}}') = {{year}}),
    'artifacts',              (SELECT artifacts FROM src_counts),
    'scheduled_runs',         (SELECT scheduled_runs FROM src_counts)
) AS j;
