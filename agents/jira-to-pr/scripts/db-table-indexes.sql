-- =============================================================================
-- jira-to-pr · index inventory for LARGE tables (optional, second file)
-- =============================================================================
-- WHY:  for tables above ~1M rows the agent must know which columns are
--       indexed so it never writes a WHERE / JOIN / ORDER BY that forces a full
--       scan. The schema dumps in Tools/.docker/data cover this too, but only
--       when the Docker quality environment is set up — this file makes the
--       information available even without it.
--
-- WHERE / HOW: same hosts and same command as db-table-stats.sql, output to
--   products/Tools/working/db-stats/indexes-<host-label>-$(date +%F).tsv
-- =============================================================================

SELECT
    @@hostname                                                   AS host,
    s.TABLE_SCHEMA                                               AS db_schema,
    s.TABLE_NAME                                                 AS table_name,
    s.INDEX_NAME                                                 AS index_name,
    IF(s.NON_UNIQUE = 0, 'unique', 'non-unique')                 AS uniqueness,
    GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX SEPARATOR ', ') AS columns,
    MAX(s.CARDINALITY)                                           AS cardinality
FROM information_schema.STATISTICS s
JOIN information_schema.TABLES t
  ON t.TABLE_SCHEMA = s.TABLE_SCHEMA AND t.TABLE_NAME = s.TABLE_NAME
WHERE t.TABLE_TYPE = 'BASE TABLE'
  AND t.TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
  AND (t.TABLE_ROWS >= 1000000 OR (t.DATA_LENGTH + t.INDEX_LENGTH) >= 1024 * 1024 * 1024)
GROUP BY s.TABLE_SCHEMA, s.TABLE_NAME, s.INDEX_NAME, s.NON_UNIQUE
ORDER BY s.TABLE_SCHEMA, s.TABLE_NAME, s.INDEX_NAME;
