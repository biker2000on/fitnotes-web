-- Preview: which historical workout days match which routine day-splits.
-- Score = fraction of the split's exercises that appear in the day's log.
WITH day_ex AS (
    SELECT user_id, date, exercise_id
    FROM training_logs
    WHERE NOT is_deleted
    GROUP BY user_id, date, exercise_id
),
sec AS (
    SELECT r.user_id, rs.id AS section_id, rs.routine_id,
           r.name AS routine_name, rs.name AS section_name, rse.exercise_id
    FROM routine_sections rs
    JOIN routines r ON r.id = rs.routine_id AND NOT r.is_deleted
    JOIN routine_section_exercises rse
      ON rse.routine_section_id = rs.id AND NOT rse.is_deleted
    WHERE NOT rs.is_deleted
),
sec_size AS (
    SELECT section_id, count(*) AS n FROM sec GROUP BY section_id
),
overlap AS (
    SELECT d.user_id, d.date, s.section_id, s.routine_id,
           s.routine_name, s.section_name, count(*) AS hits
    FROM day_ex d
    JOIN sec s ON s.user_id = d.user_id AND s.exercise_id = d.exercise_id
    GROUP BY d.user_id, d.date, s.section_id, s.routine_id, s.routine_name, s.section_name
),
scored AS (
    SELECT o.*, ss.n,
           round((o.hits::numeric / ss.n), 2) AS score,
           row_number() OVER (
               PARTITION BY o.user_id, o.date
               ORDER BY o.hits::numeric / ss.n DESC, ss.n DESC
           ) AS rk
    FROM overlap o
    JOIN sec_size ss ON ss.section_id = o.section_id
    WHERE ss.n >= 2
      AND o.hits >= 2
      AND o.hits::numeric / ss.n >= 0.6
)
SELECT u.email, sc.date, sc.routine_name, sc.section_name,
       sc.hits || '/' || sc.n AS matched, sc.score
FROM scored sc
JOIN users u ON u.id = sc.user_id
WHERE sc.rk = 1
  AND NOT EXISTS (
      SELECT 1 FROM workout_routines wr
      WHERE wr.user_id = sc.user_id AND wr.date = sc.date AND NOT wr.is_deleted
  )
ORDER BY u.email, sc.date;
