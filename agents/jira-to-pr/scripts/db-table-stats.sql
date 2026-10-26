-- =============================================================================
-- jira-to-pr · production table-size inventory
-- =============================================================================
-- WHY:  the agent needs to know how big each table is before it writes SQL,
--       Doctrine queries or migrations against it. Row counts are not in the
--       codebase, so a human runs this once per MySQL host and hands the
--       output to scripts/import-db-stats.py, which produces
--       config/db-table-stats.md (rounded tiers, no exact business numbers).
--
-- WHERE: run on EVERY MySQL host that serves Tools / ListingSyncer production
--        data — ideally on a read replica. Known hosts (from config/local.ini):
--          main (brightlocal + rankings) · batches · proxies · buried-jobs
--          rankings shards (shard_01..shard_10) · profiles · logging
--          active-location · listing_syncer
--        It only reads information_schema; SELECT on information_schema is enough.
--
-- SAFETY: on MySQL < 8.0 check `SHOW VARIABLES LIKE 'innodb_stats_on_metadata';`
--         first. If it is ON, this query triggers a stats refresh on every table —
--         run it on a replica or ask a DBA. (Default is OFF since 5.6.6.)
--
-- HOW:
--   mysql -h <replica-host> -u <readonly-user> -p --batch --raw \
--         < agents/jira-to-pr/scripts/db-table-stats.sql \
--         > products/Tools/working/db-stats/tables-<host-label>-$(date +%F).tsv
--   (a CSV/TSV export from DataGrip / Sequel Ace works just as well)
--
-- NOTE: TABLE_ROWS is an InnoDB estimate (±10–20 %). That is precise enough —
--       the agent only needs the order of magnitude.
-- =============================================================================

SELECT
    @@hostname                                               AS host,
    t.TABLE_SCHEMA                                           AS db_schema,
    t.TABLE_NAME                                             AS table_name,
    t.ENGINE                                                 AS engine,
    t.TABLE_ROWS                                             AS approx_rows,
    ROUND(t.DATA_LENGTH / 1024 / 1024)                       AS data_mb,
    ROUND(t.INDEX_LENGTH / 1024 / 1024)                      AS index_mb,
    ROUND((t.DATA_LENGTH + t.INDEX_LENGTH) / 1024 / 1024)    AS total_mb,
    t.AUTO_INCREMENT                                         AS auto_increment,
    (
        SELECT COUNT(DISTINCT s.INDEX_NAME)
        FROM information_schema.STATISTICS s
        WHERE s.TABLE_SCHEMA = t.TABLE_SCHEMA
          AND s.TABLE_NAME   = t.TABLE_NAME
    )                                                        AS index_count
FROM information_schema.TABLES t
WHERE t.TABLE_TYPE = 'BASE TABLE'
  AND t.TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
ORDER BY (t.DATA_LENGTH + t.INDEX_LENGTH) DESC, t.TABLE_SCHEMA, t.TABLE_NAME;
