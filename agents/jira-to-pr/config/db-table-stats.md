# Production database table sizes

Generated 2026-10-26 by `scripts/import-db-stats.py`. Do not edit by hand — re-run the
importer after a fresh export (`scripts/db-table-stats.sql`, `scripts/db-table-indexes.sql`).

**Sources**

- mysql-prod-01 / brightlocal — `tables-mysql-prod-01-brightlocal-2026-10-26.csv` (512 tables, exported 2026-10-26)
- indexes: `indexes-mysql-prod-01-brightlocal-2026-10-26.csv` (329 index rows, exported 2026-10-26)

**Not covered** (no export available): `batches`, `jobs`, `proxy`, `profiles`, `logging`, `local_active_location`, `listing_syncer`, `shard_01`, `shard_02`, `shard_03`, `shard_04`, `shard_05`, `shard_06`, `shard_07`, `shard_08`, `shard_09`, `shard_10`.
Treat tables from these schemas as **L**, and say so in the plan's *Data volume impact* section.

## How to read this file

Counts are InnoDB estimates rounded to two significant figures (±20 %); only the order of
magnitude matters. Sizes are data + indexes. Rules for each tier live in
`db-query-guidelines.md`.

| Tier | Definition | Tables |
|---|---|---|
| **XL** | ≥ 10M rows or ≥ 5 GB | 43 |
| **L** | ≥ 1M rows or ≥ 512 MB | 55 |
| **M** | ≥ 100k rows or ≥ 64 MB | 102 |
| **S** | everything else | 312 |

## XL tables (≥ 10M rows or ≥ 5 GB)

| Table | ~Rows | Size | Avg row | Indexes | Notes |
|---|---|---|---|---|---|
| `brightlocal.lsrc_ranking_positions_by_week` | ~1.6B | 360 GB | 0.1 KB | 2 |  |
| `brightlocal.listing_syncer_request_logs` | ~29M | 180 GB | 6.3 KB | 3 | wide rows (~6 KB) — never `SELECT *` |
| `brightlocal.rf_reviews_runs` | ~450M | 160 GB | 0.1 KB | 5 |  |
| `brightlocal.gpw_citations_v3` | ~590M | 150 GB | 0.2 KB | 2 |  |
| `brightlocal.google_place` | ~33M | 140 GB | 4.0 KB | 12 |  |
| `brightlocal.lsrc_unblended_ranking_positions_by_week` | ~850M | 140 GB | 0.1 KB | 2 |  |
| `brightlocal.lsrc_ranking_positions_by_week_split` | ~440M | 120 GB | 0.2 KB | 2 |  |
| `brightlocal.gpw_google_place_history` | ~16M | 110 GB | 7.4 KB | 2 | wide rows (~7 KB) — never `SELECT *` |
| `brightlocal.async_events` | ~240M | 92 GB | 0.4 KB | 2 |  |
| `brightlocal.listing_profile_states` | ~3.8M | 79 GB | 21.8 KB | 3 | wide rows (~22 KB) — never `SELECT *` |
| `brightlocal.grc_report_run_rank_data` | ~3.4M | 77 GB | 23.8 KB | 2 | wide rows (~24 KB) — never `SELECT *` |
| `brightlocal.rf_reviews` | ~73M | 59 GB | 0.6 KB | 7 |  |
| `brightlocal.google_place_citations` | ~790M | 51 GB | 0.0 KB | 2 |  |
| `brightlocal.gmb_location` | ~9.3M | 38 GB | 4.0 KB | 7 | wide rows (~4 KB) — never `SELECT *` |
| `brightlocal.lsrc_campaign_history` | ~23M | 37 GB | 1.5 KB | 10 |  |
| `brightlocal.ct2_ct_citations` | ~99M | 37 GB | 0.2 KB | 5 |  |
| `brightlocal.ct_competitor_citations` | ~190M | 35 GB | 0.1 KB | 3 |  |
| `brightlocal.change_log` | ~4.7M | 35 GB | 7.7 KB | 3 | wide rows (~8 KB) — never `SELECT *` |
| `brightlocal.scu_report_runs_data` | ~420k | 27 GB | 68.2 KB | 1 | wide rows (~68 KB) — never `SELECT *`; only PRIMARY — any other filter is a full scan |
| `brightlocal.lsrc_summary_stats` | ~81M | 24 GB | 0.1 KB | 5 |  |
| `brightlocal.ct2_ct_citations_url` | ~93M | 19 GB | 0.2 KB | 2 |  |
| `brightlocal.cb_campaign_citations` | ~46M | 17 GB | 0.2 KB | 11 |  |
| `brightlocal.location_summary_report_summaries` | ~9.5M | 15 GB | 1.5 KB | 5 |  |
| `brightlocal.lm_external_updates` | ~14M | 13 GB | 0.8 KB | 6 |  |
| `brightlocal.active_sync_updates` | ~1.8M | 12 GB | 6.9 KB | 6 | wide rows (~7 KB) — never `SELECT *` |
| `brightlocal.braintree_payment_process_flow_log` | ~590k | 9.5 GB | 16.9 KB | 2 | wide rows (~17 KB) — never `SELECT *` |
| `brightlocal.api_key_request_logs` | ~43M | 8.2 GB | 0.1 KB | 4 |  |
| `brightlocal.subscription_tool_event_log` | ~45M | 8.1 GB | 0.1 KB | 3 |  |
| `brightlocal.schedule_block_items` | ~48M | 8.1 GB | 0.1 KB | 3 |  |
| `brightlocal.cb_data_history` | ~440k | 8.1 GB | 19.0 KB | 2 | wide rows (~19 KB) — never `SELECT *` |
| `brightlocal.rm_gmb_review_run_errors` | ~1.9M | 6.6 GB | 3.6 KB | 2 |  |
| `brightlocal.rf_report_runs` | ~63M | 6.6 GB | 0.1 KB | 3 |  |
| `brightlocal.lsrc_ranking_positions_by_history` | ~88M | 6.1 GB | 0.1 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.cb_data` | ~240k | 5.4 GB | 24.2 KB | 1 | wide rows (~24 KB) — never `SELECT *`; only PRIMARY — any other filter is a full scan |
| `brightlocal.moz_ranking` | ~30M | 5 GB | 0.1 KB | 3 |  |
| `brightlocal.lsrc_ranking_positions_by_history_split` | ~46M | 4.1 GB | 0.1 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.ct_report_domains` | ~19M | 3.8 GB | 0.1 KB | 4 |  |
| `brightlocal.gpw_screenshots` | ~16M | 2.8 GB | 0.2 KB | 2 |  |
| `brightlocal.ct_report_runs` | ~10M | 2.7 GB | 0.1 KB | 7 |  |
| `brightlocal.lsrc_search_query_summaries` | ~18M | 2.5 GB | 0.0 KB | 5 |  |
| `brightlocal.lsrc_unblended_ranking_positions_by_history` | ~32M | 1.6 GB | 0.1 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.grc_keywords_runs` | ~25M | 1.5 GB | 0.0 KB | 2 |  |
| `brightlocal.gpw_search_competitors` | ~12M | 1.4 GB | 0.1 KB | 3 |  |

## L tables (≥ 1M rows or ≥ 512 MB)

| Table | ~Rows | Size | Avg row | Indexes | Notes |
|---|---|---|---|---|---|
| `brightlocal.cl_customer_locations` | ~1.5M | 4.5 GB | 2.9 KB | 8 |  |
| `brightlocal.rf_directories` | ~3.7M | 4 GB | 0.9 KB | 5 |  |
| `brightlocal.rf_reviews_yelp_backup` | ~4.5M | 3.8 GB | 0.9 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.lsrc_ru_report_search_term_rankings` | ~7.6M | 3.4 GB | 0.3 KB | 5 |  |
| `brightlocal.cb_indexing_services_links` | ~8.5M | 2.7 GB | 0.1 KB | 3 |  |
| `brightlocal.lsrc_campaign_keywords` | ~9.5M | 2.3 GB | 0.1 KB | 3 |  |
| `brightlocal.braintree_webhook_inbox` | ~38k | 2 GB | 52.7 KB | 6 | wide rows (~53 KB) — never `SELECT *` |
| `brightlocal.profile_batch` | ~2.7M | 2 GB | 0.8 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.customer_subscriptions_snapshots` | ~230k | 1.9 GB | 8.7 KB | 2 | wide rows (~9 KB) — never `SELECT *` |
| `brightlocal.local_brain_report_snapshots` | ~62k | 1.8 GB | 29.8 KB | 2 | wide rows (~30 KB) — never `SELECT *` |
| `brightlocal.listing_pf_request_logs` | ~620k | 1.7 GB | 2.7 KB | 2 |  |
| `brightlocal.open_ai_requests` | ~410k | 1.7 GB | 4.2 KB | 2 | wide rows (~4 KB) — never `SELECT *` |
| `brightlocal.gmb_location_additional_data` | ~230k | 1.6 GB | 7.3 KB | 2 | wide rows (~7 KB) — never `SELECT *` |
| `brightlocal.gmb_media_items` | ~2.8M | 1.5 GB | 0.6 KB | 2 |  |
| `brightlocal.grc_report_runs` | ~4.2M | 1.5 GB | 0.2 KB | 8 |  |
| `brightlocal.cb_log_citation_submission` | ~4.7M | 1.5 GB | 0.1 KB | 8 |  |
| `brightlocal.gpw_customer_reviews` | ~3.1M | 1.4 GB | 0.5 KB | 2 |  |
| `brightlocal.cl_customer_location_images` | ~2.5M | 1.4 GB | 0.4 KB | 3 |  |
| `brightlocal.lsrc_campaigns` | ~530k | 1.1 GB | 1.8 KB | 12 |  |
| `brightlocal.local_brain_insights` | ~57k | 1 GB | 18.7 KB | 4 | wide rows (~19 KB) — never `SELECT *` |
| `brightlocal.scu_report_ld_profile_urls` | ~7.4M | 1000 MB | 0.1 KB | 2 |  |
| `brightlocal.gpw_report_runs` | ~4.9M | 1000 MB | 0.1 KB | 7 |  |
| `brightlocal.google_accounts` | ~190k | 1000 MB | 5.5 KB | 3 | wide rows (~5 KB) — never `SELECT *` |
| `brightlocal.rm_showcase_widget_referers` | ~3.1M | 1000 MB | 0.3 KB | 2 |  |
| `brightlocal.login_logs` | ~4.3M | 810 MB | 0.1 KB | 2 |  |
| `brightlocal.cb_campaigns` | ~570k | 740 MB | 1.2 KB | 9 |  |
| `brightlocal.braintree_payment_errors` | ~68k | 730 MB | 11.0 KB | 2 | wide rows (~11 KB) — never `SELECT *` |
| `brightlocal.lsrc_campaign_history_competitors` | ~5M | 720 MB | 0.1 KB | 2 |  |
| `brightlocal.avalara_customer_payment_process_log` | ~53k | 700 MB | 13.4 KB | 2 | wide rows (~13 KB) — never `SELECT *` |
| `brightlocal.customer_log` | ~4M | 690 MB | 0.1 KB | 3 |  |
| `brightlocal.rm_facebook_review_run_errors` | ~3M | 650 MB | 0.2 KB | 2 |  |
| `brightlocal.majestic_rankings` | ~4.7M | 640 MB | 0.1 KB | 3 |  |
| `brightlocal.ct_competitors_v2` | ~3.3M | 590 MB | 0.1 KB | 3 |  |
| `brightlocal.free_tool_request_logs` | ~3.3M | 550 MB | 0.1 KB | 3 |  |
| `brightlocal.location_dashboard_settings` | ~2M | 540 MB | 0.2 KB | 4 |  |
| `brightlocal.ct_nap_status_summaries` | ~3.1M | 540 MB | 0.1 KB | 2 |  |
| `brightlocal.planhat_relations` | ~1.5M | 530 MB | 0.2 KB | 3 |  |
| `brightlocal.cl_website_metrics_history` | ~2.5M | 530 MB | 0.1 KB | 3 |  |
| `brightlocal.google_place_citations_summary` | ~6.5M | 500 MB | 0.0 KB | 2 |  |
| `brightlocal.customer_credits_usages` | ~2.3M | 440 MB | 0.1 KB | 2 |  |
| `brightlocal.ct_report_summary` | ~6.6M | 430 MB | 0.0 KB | 2 |  |
| `brightlocal.email_validation_results` | ~1.1M | 410 MB | 0.3 KB | 2 |  |
| `brightlocal.cb_campaign_publisher_directories` | ~1M | 370 MB | 0.3 KB | 4 |  |
| `brightlocal.rm_contacts` | ~1M | 360 MB | 0.2 KB | 5 |  |
| `brightlocal.cb_campaign_changes` | ~1.6M | 310 MB | 0.1 KB | 3 |  |
| `brightlocal.ct_removed_citations_log` | ~2M | 290 MB | 0.1 KB | 2 |  |
| `brightlocal.rm_campaign_customers` | ~1.3M | 250 MB | 0.1 KB | 6 |  |
| `brightlocal.cl_reports_count` | ~2.7M | 240 MB | 0.1 KB | 2 |  |
| `brightlocal.cb_citations_url` | ~1.8M | 240 MB | 0.1 KB | 2 |  |
| `brightlocal.gpw_search_terms` | ~1.5M | 220 MB | 0.1 KB | 3 |  |
| `brightlocal.location_dashboard_wl_tool_availability` | ~2.2M | 190 MB | 0.1 KB | 3 |  |
| `brightlocal.rm_campaign_events` | ~1.8M | 180 MB | 0.1 KB | 2 |  |
| `brightlocal.grc_report_keywords` | ~1.9M | 160 MB | 0.1 KB | 2 |  |
| `brightlocal.user_ip_logs` | ~1.2M | 150 MB | 0.1 KB | 4 |  |
| `brightlocal.cb_campaign_sent_notifications` | ~1.7M | 140 MB | 0.0 KB | 2 |  |

## M tables (≥ 100k rows or ≥ 64 MB)

| Table | ~Rows | Size | Avg row | Indexes | Notes |
|---|---|---|---|---|---|
| `brightlocal.datashake_request_cache` | ~5.1k | 510 MB | 102.7 KB | 2 | wide rows (~103 KB) — never `SELECT *` |
| `brightlocal.deel_responses` | ~190k | 500 MB | 2.7 KB | 3 |  |
| `brightlocal.scu_reports` | ~420k | 490 MB | 1.1 KB | 4 |  |
| `brightlocal.customer_payments` | ~920k | 430 MB | 0.4 KB | 6 |  |
| `brightlocal.customer_payments_vendor_transaction_data` | ~16k | 380 MB | 24.5 KB | 1 | wide rows (~25 KB) — never `SELECT *` |
| `brightlocal.ct_reports` | ~580k | 310 MB | 0.4 KB | 7 |  |
| `brightlocal.rm_gmb_review_respond_errors` | ~21k | 300 MB | 14.8 KB | 2 | wide rows (~15 KB) — never `SELECT *` |
| `brightlocal.twitter_reply` | ~720k | 280 MB | 0.3 KB | 3 |  |
| `brightlocal.grc_reports` | ~270k | 280 MB | 0.9 KB | 4 |  |
| `brightlocal.tokens` | ~800k | 240 MB | 0.1 KB | 3 |  |
| `brightlocal.onboarding_log` | ~360k | 240 MB | 0.6 KB | 2 |  |
| `brightlocal.active_sync_requests` | ~760k | 230 MB | 0.1 KB | 4 |  |
| `brightlocal.active_sync_additional_verification_requests` | ~8.3k | 230 MB | 28.0 KB | 2 | wide rows (~28 KB) — never `SELECT *` |
| `brightlocal.lead_gen_business` | ~29k | 220 MB | 8.0 KB | 1 | wide rows (~8 KB) — never `SELECT *` |
| `brightlocal.grc_report_snapshots` | ~250k | 180 MB | 0.7 KB | 2 |  |
| `brightlocal.onboarding_tasks` | ~800k | 180 MB | 0.1 KB | 2 |  |
| `brightlocal.customers` | ~430k | 170 MB | 0.2 KB | 5 |  |
| `brightlocal.rm_review_sites` | ~580k | 160 MB | 0.2 KB | 5 |  |
| `brightlocal.paypal_payment_flow_log` | ~300k | 150 MB | 0.5 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.gbp_posts` | ~85k | 150 MB | 1.7 KB | 2 |  |
| `brightlocal.users` | ~270k | 140 MB | 0.3 KB | 9 |  |
| `brightlocal.lsrc_ru_report_leaderboards` | ~380k | 130 MB | 0.3 KB | 2 |  |
| `brightlocal.paypal_ipn_notifications` | ~250k | 130 MB | 0.4 KB | 4 |  |
| `brightlocal.jwt_refresh_tokens` | ~240k | 130 MB | 0.2 KB | 8 |  |
| `brightlocal.deel_tasks` | ~160k | 130 MB | 0.5 KB | 6 |  |
| `brightlocal.ls_yelp_requests` | ~10k | 120 MB | 11.9 KB | 3 | wide rows (~12 KB) — never `SELECT *` |
| `brightlocal.hrz_rm_reports` | ~200k | 120 MB | 0.3 KB | 4 |  |
| `brightlocal.lead_gen_leads` | ~120k | 120 MB | 0.9 KB | 5 |  |
| `brightlocal.cb_campaign_changes_log` | ~770k | 120 MB | 0.1 KB | 2 |  |
| `brightlocal.gmb_connection_errors` | ~6k | 120 MB | 19.6 KB | 2 | wide rows (~20 KB) — never `SELECT *` |
| `brightlocal.grc_map_screenshots` | ~250k | 110 MB | 0.4 KB | 3 |  |
| `brightlocal.custom_credits` | ~870k | 110 MB | 0.1 KB | 2 |  |
| `brightlocal.gpw_reports` | ~300k | 110 MB | 0.3 KB | 6 |  |
| `brightlocal.ls_data_axle_locations` | ~15k | 110 MB | 7.4 KB | 1 | wide rows (~7 KB) — never `SELECT *` |
| `brightlocal.profile_finder_misses` | ~210k | 99 MB | 0.2 KB | 4 |  |
| `brightlocal.cb_pre_submission_profiles_comparison` | ~48k | 94 MB | 2.0 KB | 2 |  |
| `brightlocal.rm_sms_contacts` | ~230k | 93 MB | 0.3 KB | 4 |  |
| `brightlocal.gmb_account` | ~370k | 89 MB | 0.1 KB | 5 |  |
| `brightlocal.customer_subscriptions` | ~460k | 88 MB | 0.1 KB | 3 |  |
| `brightlocal.cb_campaign_notes` | ~310k | 88 MB | 0.2 KB | 3 |  |
| `brightlocal.scu_report_runs` | ~520k | 84 MB | 0.1 KB | 4 |  |
| `brightlocal.cb_campaigns_cost` | ~580k | 81 MB | 0.1 KB | 2 |  |
| `brightlocal.cb_secondary_campaigns` | ~240k | 81 MB | 0.2 KB | 6 |  |
| `brightlocal.bing_additional_data` | ~280k | 77 MB | 0.2 KB | 2 |  |
| `brightlocal.scu_report_social_profiles` | ~700k | 76 MB | 0.1 KB | 2 |  |
| `brightlocal.braintree_payment_log` | ~69k | 76 MB | 1.0 KB | 3 |  |
| `brightlocal.ct_top_directories_summaries` | ~610k | 71 MB | 0.1 KB | 2 |  |
| `brightlocal.rm_campaigns` | ~160k | 70 MB | 0.2 KB | 6 |  |
| `brightlocal.tmp_rackspace_images_migration` | ~200k | 64 MB | 0.3 KB | 2 |  |
| `brightlocal.agency_directory_reviews` | ~86k | 64 MB | 0.7 KB | 2 |  |
| `brightlocal.cl_ct_location` | ~580k | 63 MB | 0.0 KB | 3 |  |
| `brightlocal.customer_subscriptions_snapshots_all` | ~110k | 61 MB | 0.6 KB | 2 |  |
| `brightlocal.hrz_gbp_views_reports` | ~160k | 60 MB | 0.2 KB | 4 |  |
| `brightlocal.cl_lsrc_location` | ~620k | 57 MB | 0.0 KB | 3 |  |
| `brightlocal.hrz_gbp_actions_reports` | ~160k | 57 MB | 0.2 KB | 4 |  |
| `brightlocal.rf_reports` | ~240k | 54 MB | 0.2 KB | 4 |  |
| `brightlocal.lsrc_competitors` | ~230k | 53 MB | 0.1 KB | 2 |  |
| `brightlocal.cb_campaign_publishers` | ~640k | 52 MB | 0.1 KB | 2 |  |
| `brightlocal.rm_campaign_logs` | ~500k | 52 MB | 0.1 KB | 2 |  |
| `brightlocal.gpw_customers` | ~220k | 51 MB | 0.2 KB | 2 |  |
| `brightlocal.cb_campaign_partners` | ~650k | 50 MB | 0.0 KB | 2 |  |
| `brightlocal.lsrc_ru_report_search_term_rankings_by_groups` | ~510k | 50 MB | 0.1 KB | 2 |  |
| `brightlocal.cl_cb_location` | ~490k | 46 MB | 0.1 KB | 3 |  |
| `brightlocal.rm_sms_contact_events` | ~410k | 44 MB | 0.1 KB | 2 |  |
| `brightlocal.email_provider_data` | ~330k | 44 MB | 0.1 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.customer_settings` | ~240k | 44 MB | 0.1 KB | 2 |  |
| `brightlocal.cl_lscu_location` | ~450k | 42 MB | 0.0 KB | 3 |  |
| `brightlocal.sign_up_answers` | ~360k | 40 MB | 0.1 KB | 2 |  |
| `brightlocal.rm_campaigns_summaries` | ~160k | 40 MB | 0.2 KB | 5 |  |
| `brightlocal.facebook_location_additional_data` | ~120k | 39 MB | 0.2 KB | 2 |  |
| `brightlocal.lsrc_field_counts` | ~650k | 38 MB | 0.0 KB | 2 |  |
| `brightlocal.lsrc_campaign_tags` | ~360k | 38 MB | 0.1 KB | 2 |  |
| `brightlocal.active_sync_settings` | ~340k | 35 MB | 0.1 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.lsrc_scheduled_block_items` | ~240k | 34 MB | 0.1 KB | 2 |  |
| `brightlocal.customer_subscriptions_20230403` | ~210k | 34 MB | 0.1 KB | 3 |  |
| `brightlocal.rm_sms_limits` | ~200k | 34 MB | 0.1 KB | 3 |  |
| `brightlocal.google_account_location` | ~120k | 34 MB | 0.1 KB | 5 |  |
| `brightlocal.gpw_customer_history` | ~410k | 31 MB | 0.0 KB | 2 |  |
| `brightlocal.cl_gpw_location` | ~310k | 31 MB | 0.0 KB | 3 |  |
| `brightlocal.cl_rf_location` | ~230k | 28 MB | 0.0 KB | 4 |  |
| `brightlocal.cl_grc_location` | ~310k | 27 MB | 0.0 KB | 3 |  |
| `brightlocal.cli_command_tracker` | ~230k | 27 MB | 0.1 KB | 2 |  |
| `brightlocal.customer_billing_addresses` | ~200k | 25 MB | 0.1 KB | 2 |  |
| `brightlocal.rm_contact_feedback` | ~210k | 24 MB | 0.1 KB | 2 |  |
| `brightlocal.cb_campaign_creation_sources` | ~450k | 23 MB | 0.0 KB | 2 |  |
| `brightlocal.nap_cities` | ~170k | 23 MB | 0.1 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.shard_mappings` | ~180k | 21 MB | 0.1 KB | 2 |  |
| `brightlocal.apple_additional_data` | ~100k | 21 MB | 0.1 KB | 2 |  |
| `brightlocal.lsrc_ru_report_campaigns` | ~410k | 19 MB | 0.0 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.lsrc_customer_adhoc_runs` | ~530k | 18 MB | 0.0 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.ct_report_dead_citations_checks` | ~290k | 18 MB | 0.0 KB | 2 |  |
| `brightlocal.cb_credits` | ~240k | 18 MB | 0.1 KB | 2 |  |
| `brightlocal.cl_customer_clients` | ~130k | 18 MB | 0.1 KB | 2 |  |
| `brightlocal.onboarding_tasks_event_log` | ~220k | 17 MB | 0.1 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.customer_company_details_delete_after_q1_2024` | ~140k | 17 MB | 0.1 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.rm_contact_lists` | ~190k | 16 MB | 0.1 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.business_category_localisations` | ~100k | 15 MB | 0.1 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.api_key_request_summary` | ~140k | 14 MB | 0.1 KB | 1 | only PRIMARY — any other filter is a full scan |
| `brightlocal.lsg_planned_credits` | ~130k | 14 MB | 0.1 KB | 2 |  |
| `brightlocal.cl_stared_location` | ~130k | 12 MB | 0.0 KB | 2 |  |
| `brightlocal.lsrc_campaign_keyword_group_keywords` | ~160k | 10 MB | 0.0 KB | 2 |  |
| `brightlocal.rm_get_review_capabilities_usages` | ~130k | 10 MB | 0.0 KB | 2 |  |

## S tables (everything else)

Small enough that any indexed or even unindexed read is fine outside hot loops.

**brightlocal:**
`_bak_location_summary_report_summaries_am4614` (<1k), `_rm_web_feedback_new` (0),
`account_deletion_logs` (~43k), `account_deletion_requests` (~3k),
`active_customers_country_stats` (~12k), `active_customers_package_stats` (~11k),
`active_sync_additional_verification_emails` (~1.1k), `active_sync_media_updates` (~2.4k),
`active_sync_states_map_bing` (~47k), `active_sync_statistics_logs` (~48k),
`active_sync_update_log` (~2.2k), `active_sync_updates_assigned_agents` (<1k),
`addon_bulk_purchase` (<1k), `addon_capabilities` (<1k), `addons` (<1k),
`agency_directory_listing_verification_requests` (~1.2k), `agency_directory_listings` (~11k),
`agency_directory_reviews_fetch_log` (~53k), `ai_visibility_report_configs` (~4.7k),
`ai_visibility_reports` (~4.6k), `api_gateway_customers` (<1k), `api_key_individual_pricing` (<1k),
`api_key_ip_address_summary` (~3.4k), `api_keys` (~7.9k), `api_proxy_limit_emails` (<1k),
`api_proxy_limits` (<1k), `api_proxy_usage` (~5k), `apple_categories` (~5.5k),
`apple_connections` (~28k), `apple_listing_metadata` (~8.9k), `apple_listings` (~6.6k),
`area_codes` (<1k), `async_event_queue` (~1.4k), `avalara_failed_transaction_log` (~6.2k),
`bing_categories` (~2.7k), `bing_categories_service_area_backup_lm4142` (~2.7k),
`bing_categories_unknown` (~1.6k), `bing_connections` (~18k), `bing_listing_statuses` (~8.5k),
`bing_locations_to_delete` (~13k), `business_categories` (~12k), `business_groups` (<1k),
`cb_as_selected` (~1.1k), `cb_campaign_complexity_scores` (~7.8k),
`cb_campaign_customer_flows` (~2.6k), `cb_campaign_duplicates` (~9.9k),
`cb_campaign_duplicates_reviews` (~29k), `cb_campaign_labels` (<1k),
`cb_campaign_order_bundles` (<1k), `cb_campaign_order_items` (<1k),
`cb_campaign_partial_refunds` (~15k), `cb_campaign_prioritizations` (~5.2k),
`cb_campaign_workers` (~25k), `cb_categories_map` (~5.6k),
`cb_citation_auto_submission_attempts` (~12k), `cb_citation_country` (~12k),
`cb_citation_note` (<1k), `cb_citation_note_citation` (<1k), `cb_citations` (~4.8k),
`cb_citations_business_categories` (~33k), `cb_credit_packages` (<1k), `cb_employees` (<1k),
`cb_experiment_campaign_assignments` (~25k), `cb_experiment_cases` (<1k),
`cb_experiment_customer_assignments` (~13k), `cb_internal_customer_notes` (<1k),
`cb_log_bonus_quality` (0), `cb_log_bonus_quantity` (0), `cb_log_campaign_quality` (~3.7k),
`cb_log_rates` (<1k), `cb_log_work_days` (0), `cb_notifications` (<1k), `cb_packages` (<1k),
`cb_pandio` (~55k), `cb_partners` (<1k), `cb_payments_discount` (~9.8k),
`cb_pre_submission_comparison_jobs` (<1k), `cb_pre_submission_comparison_reviews` (~10k),
`cb_submission_note_messages` (<1k), `cb_tmp_alerts_log` (~3.3k), `chatgpt_requests` (~2.5k),
`checkout_coupon_products` (<1k), `checkout_coupons` (<1k), `checkout_discounts` (0),
`checkout_payment_attempts` (0), `checkout_products` (<1k), `checkout_session_items` (<1k),
`checkout_sessions` (<1k), `cities` (~53k), `cl_customer_location_google_listing_tracking` (~2.2k),
`cl_location_addons` (~29k), `cl_location_bulk_upload_failure_reports` (<1k),
`cl_stared_client` (~6.6k), `cl_status_change_log` (~61k), `client_access_settings` (~84k),
`clockwork` (<1k), `compliance_entries` (~84k), `countries` (<1k),
`ct_customer_top_directories` (<1k), `ct_lookup` (~14k), `ct_lookup_blacklist` (<1k),
`ct_packages` (<1k), `ct_report_import_logs` (<1k), `ct_ru_directories` (~14k),
`ct_ru_directories_backup_2024_Version20240530085918` (~20k), `ct_seomoz_data` (~59k),
`customer_active_sync_addons` (~11k), `customer_addon_price_change_log` (~20k),
`customer_addons` (~56k), `customer_agency_directory_details` (<1k), `customer_cities` (~1k),
`customer_exit_survey` (~7.5k), `customer_notifications_log` (~16k),
`customer_payment_provider_references` (0), `customer_payments_has_tag` (0),
`customer_payments_item` (~37k), `customer_payments_item_has_tag` (~71k),
`customer_payments_item_tag` (<1k), `customer_payments_item_type` (<1k), `customer_payments_tag` (0),
`customer_subscription_price_change_log` (~44k),
`customer_subscription_price_version_migration_log` (~4.5k),
`customer_subscriptions_snapshots_pe_3000` (~95k), `deel_contracts` (<1k),
`deel_payroll_batch` (<1k), `deel_rates` (0), `early_warnings_reviews` (~43k),
`early_warnings_reviews_directories` (<1k), `enterprise_payments_periods` (~2.6k),
`exchange_rates` (<1k), `facebook_access_token` (~26k), `facebook_account` (~24k),
`facebook_account_location` (~60k), `facebook_page_delayed_updates` (~93k), `feature_flags` (<1k),
`flags` (<1k), `gbp_oauth_flow_tracking` (<1k), `gbp_post_publish_logs` (~15k),
`gdpr_unsubscribed_emails` (~27k), `gmb_categories` (~7.2k), `gmb_category_localisations` (~93k),
`gmb_location_additional_data_images` (~22k), `gpw_customer_duplicates` (~63k), `grc_keywords` (0),
`grc_notifications_track` (<1k), `hrz_lsg_reports` (~86k), `invoices` (~32k), `ip_blacklist` (<1k),
`lead_gen_banned_ips` (<1k), `lead_gen_lead_changes_log` (~11k), `lead_gen_whitelist_ips` (~1k),
`lead_gen_widgets` (~2.8k), `lm_notifications` (~8.2k), `local_brain_website_performance` (<1k),
`location_dashboard_primary_reports` (<1k), `location_dashboard_wl_login_logs` (~34k),
`location_dashboard_wl_login_tokens` (<1k), `location_notes` (~2.5k),
`location_summary_report_types` (0), `login_impersonator_log` (~78k), `login_tokens` (~4k),
`ls_data_axle_categories` (~1.1k), `ls_data_axle_connections` (~23k),
`ls_data_axle_requests` (~6.5k), `ls_expired_aggregator_unclaims` (~7.1k),
`ls_foursquare_connections` (0), `ls_foursquare_listings` (0), `ls_foursquare_requests` (0),
`ls_foursquare_submissions` (<1k), `ls_gmb_post_publications` (0),
`ls_gmb_to_data_axle_category_map` (~2.4k), `ls_gmb_to_locafy_category_map` (~2.4k),
`ls_gmb_to_neustar_category_map` (~2.9k), `ls_gmb_to_yelp_category_map` (~3.7k),
`ls_locafy_categories` (<1k), `ls_locafy_connections` (<1k), `ls_locafy_directory_listings` (~1.4k),
`ls_locafy_locations` (<1k), `ls_locafy_requests` (<1k), `ls_neustar_categories` (~2.9k),
`ls_neustar_connections` (~29k), `ls_neustar_listings` (~26k), `ls_neustar_requests` (~6.9k),
`ls_yelp_categories` (~1.6k), `ls_yelp_connections` (~3.9k), `ls_yelp_locations` (~2.6k),
`ls_yelp_subscriptions` (<1k), `lscu_competitor_blacklist_domains` (<1k),
`lsrc_campaign_keyword_groups` (~16k), `lsrc_campaigns_custom_settings` (~33k),
`lsrc_campaigns_extra_results_counts` (~4.7k), `lsrc_match_settings` (~1.5k), `lsrc_rankings` (0),
`lsrc_rankings_shard_1` (0), `lsrc_rankings_shard_10` (0), `lsrc_rankings_shard_2` (0),
`lsrc_rankings_shard_3` (0), `lsrc_rankings_shard_4` (0), `lsrc_rankings_shard_5` (0),
`lsrc_rankings_shard_6` (0), `lsrc_rankings_shard_7` (0), `lsrc_rankings_shard_8` (0),
`lsrc_rankings_shard_9` (0), `lsrc_ru_report_search_term_rankings_groups` (~1.9k),
`lsrc_ru_report_search_term_rankings_split` (0), `lsrc_ru_reports` (~4.2k),
`lsrc_ru_reports_access_log` (~1.3k), `lsrc_scheduled_blocks` (~2.9k),
`lsrc_screenshot_settings` (~1.4k), `lsrc_temp_competitor_rank_to_customer_counts` (~15k),
`lsrc_temp_rank_to_customer_counts` (~85k), `lsrc_top_competitors` (0), `lw_users` (~2.3k),
`migration_commands` (<1k), `migrations` (~1.4k), `migrations_doctrine` (<1k),
`migrations_elasticsearch` (<1k), `nap_states` (<1k), `notes` (~21k),
`oauth_authorization_codes` (<1k), `oauth_clients` (<1k), `oauth_refresh_tokens` (~20k),
`oauth_revoked_access_tokens` (~17k), `oauth_scopes` (<1k), `onboarding_customer_statistics` (~23k),
`onboarding_settings` (~16k), `options` (~3.9k), `payments` (~3k),
`payments_credit_card_token` (~25k), `payments_discount` (0), `phone_validation_results` (~36k),
`postmark_signatures` (~3.2k), `profile_urls` (0), `provisioning_order_items` (~5.3k),
`provisioning_orders` (~2.1k), `proxies` (~19k), `rankings_settings` (~80k), `report_reruns` (0),
`report_type_countries` (<1k), `rm_ca_contact_validation_errors` (<1k),
`rm_contact_validation_errors` (<1k), `rm_facebook_pages` (~33k),
`rm_facebook_review_respond_errors` (<1k), `rm_get_review_nps_notification_settings` (<1k),
`rm_kiosk_campaign_events` (~3.6k), `rm_kiosk_campaigns` (~7.2k),
`rm_kiosk_campaigns_summaries` (~7.3k), `rm_kiosk_feedback` (~4.6k),
`rm_kiosk_feedback_clicks` (<1k), `rm_kiosk_templates` (~15k), `rm_lookup_by_location` (<1k),
`rm_overall_campaign_summaries` (<1k), `rm_report_selected_templates` (~1k),
`rm_review_auto_replies` (~16k), `rm_review_auto_replies_errors` (<1k),
`rm_review_auto_reply_rules` (<1k), `rm_review_auto_reply_rules_clients` (<1k),
`rm_review_auto_reply_rules_locations` (<1k), `rm_review_auto_reply_rules_settings` (~1.5k),
`rm_review_auto_reply_rules_templates` (~2.5k), `rm_review_reply_template` (<1k),
`rm_review_reply_template_usage` (~22k), `rm_settings` (0), `rm_showcase_widget_settings` (~1.7k),
`rm_showcase_widgets` (~21k), `rm_sms_campaigns` (~34k), `rm_sms_campaigns_summaries` (~35k),
`rm_sms_contact_lists` (~32k), `rm_sms_feedback` (~11k), `rm_sms_link_clicks` (~39k),
`rm_sms_review_site_click` (~2.8k), `rm_sms_templates` (~5.4k), `rm_sms_unsubscribed_contacts` (0),
`rm_templates` (~15k), `rm_templates_stats` (0), `rm_web_campaign_events` (~4.5k),
`rm_web_campaigns` (~7.2k), `rm_web_campaigns_summaries` (~7.2k), `rm_web_feedback` (~41k),
`rm_web_feedback_clicks` (~46k), `schedule_blocks` (~30k), `script_run_log` (~9.2k),
`scu_credit_bundles` (<1k), `scu_payg_report_credits` (~4.6k),
`sendinblue_email_bouncing_logs` (~33k), `states` (<1k), `subscription_addons` (~4.8k),
`subscription_cancellation_requests` (<1k), `subscription_capabilities` (~25k),
`subscription_combinations` (<1k), `subscription_variable_prices` (~3.2k), `subscriptions` (<1k),
`sysadmin_customer_contacts` (<1k), `sysadmin_customer_file_access_logs` (0),
`sysadmin_customer_files` (<1k), `sysadmin_customer_notes` (~1.3k), `sysadmin_team_members` (<1k),
`sysadmin_teams` (<1k), `tracking_events` (~3k), `twitter_account` (~17k),
`twitter_account_credentials` (~17k), `twitter_account_location` (~13k), `url_patterns` (~1.3k),
`user_2fa_backup_codes` (~2.2k), `user_2fa_trusted_device` (~5.5k), `user_custom_settings` (~79k),
`user_flash_messages` (~54k), `user_social_auth` (~1.4k), `user_ws_token` (<1k),
`users_domain_whitelist` (<1k), `vertical_industries` (<1k), `white_label_profiles` (~29k)

## Indexes on large tables

Every WHERE / JOIN / ORDER BY on an L or XL table must start with the leading column of one
of these indexes. *Low selectivity* marks indexes whose leading column has only a handful of
distinct values — they do not narrow a scan on their own.

### `brightlocal.lsrc_ranking_positions_by_week` — XL, ~1.6B rows, 360 GB

- `PRIMARY` (unique): campaign_id, search_engine, search_term, location, generation_year, generation_week
- `idx_campaign_engine_term_location_aggregation_date` (non-unique): campaign_id, search_engine, search_term, location, aggregation_date

### `brightlocal.listing_syncer_request_logs` — XL, ~29M rows, 180 GB

- `PRIMARY` (unique): id
- `idx_listing_syncer_request_logs_created_at_method` (non-unique): created_at, method
- `idx_listing_syncer_request_logs_instance_id` (non-unique): instance_id

### `brightlocal.rf_reviews_runs` — XL, ~450M rows, 160 GB

- `PRIMARY` (unique): run_review_id
- `directory` (non-unique): directory
- `report_id` (non-unique): report_id
- `rf_reviews_runs_report_directory_index` (non-unique): report_id, directory
- `run_id` (non-unique): run_id

### `brightlocal.gpw_citations_v3` — XL, ~590M rows, 150 GB

- `PRIMARY` (unique): id
- `url_hash` (unique): url_hash

### `brightlocal.google_place` — XL, ~33M rows, 140 GB

- `PRIMARY` (unique): id
- `cid` (non-unique): cid
- `google_id` (unique): google_id
- `idx_address` (non-unique): address
- `idx_business_name` (non-unique): business_name
- `idx_city` (non-unique): city
- `idx_country` (non-unique): country
- `idx_expiry` (non-unique): expiry
- `idx_place_id` (non-unique): place_id
- `idx_postcode` (non-unique): postcode
- `idx_telephone` (non-unique): telephone
- `query_string` (non-unique): query_string

### `brightlocal.lsrc_unblended_ranking_positions_by_week` — XL, ~850M rows, 140 GB

- `PRIMARY` (unique): campaign_id, search_engine, search_term, location, generation_year, generation_week
- `idx_campaign_engine_term_location_aggregation_date` (non-unique): campaign_id, search_engine, search_term, location, aggregation_date

### `brightlocal.lsrc_ranking_positions_by_week_split` — XL, ~440M rows, 120 GB

- `PRIMARY` (unique): campaign_id, search_engine, search_term, location, generation_year, generation_week
- `idx_campaign_engine_term_location_aggregation_date` (non-unique): campaign_id, search_engine, search_term, location, aggregation_date

### `brightlocal.gpw_google_place_history` — XL, ~16M rows, 110 GB

- `PRIMARY` (unique): id
- `google_place_id` (non-unique): google_place_id

### `brightlocal.async_events` — XL, ~240M rows, 92 GB

- `PRIMARY` (unique): id
- `idx_async_events_name_created_at` (non-unique): name, created_at

### `brightlocal.listing_profile_states` — XL, ~3.8M rows, 79 GB

- `PRIMARY` (unique): id
- `idx_directory` (non-unique): directory — **low selectivity**
- `location_uuid_idx` (non-unique): location_uuid

### `brightlocal.grc_report_run_rank_data` — XL, ~3.4M rows, 77 GB

- `PRIMARY` (unique): id
- `grc_geomap_rank_data_report_run_uuid_index` (non-unique): report_run_uuid

### `brightlocal.rf_reviews` — XL, ~73M rows, 59 GB

- `PRIMARY` (unique): review_id
- `directory` (non-unique): directory
- `report_directory_api_id_idx` (non-unique): report_id, directory, api_id
- `report_directory_hash_idx` (non-unique): report_id, directory, hash
- `report_id` (non-unique): report_id
- `report_run_id` (non-unique): report_run_id
- `timestamp` (non-unique): timestamp

### `brightlocal.google_place_citations` — XL, ~790M rows, 51 GB

- `PRIMARY` (unique): id
- `place_citation` (unique): google_place_id, gpw_citation_id

### `brightlocal.gmb_location` — XL, ~9.3M rows, 38 GB

- `PRIMARY` (unique): id
- `gmb_location_customer_id_index` (non-unique): customer_id
- `google_id_idx` (non-unique): google_location_id
- `idx_gmb_account_id` (non-unique): gmb_account_id
- `idx_google_name` (non-unique): google_name
- `idx_is_removed` (non-unique): is_removed — **low selectivity**
- `location_uuid_idx` (non-unique): location_uuid

### `brightlocal.lsrc_campaign_history` — XL, ~23M rows, 37 GB

- `PRIMARY` (unique): campaign_history_id
- `idx_batch_id` (non-unique): batch_id
- `idx_campaign_id` (non-unique): campaign_id
- `idx_customer_id` (non-unique): customer_id
- `idx_generation_date` (non-unique): generation_date
- `idx_generation_status` (non-unique): generation_status
- `idx_history_type` (non-unique): history_type — **low selectivity**
- `idx_is_archived` (non-unique): is_archived — **low selectivity**
- `idx_lookup_key` (non-unique): lookup_key
- `idx_migrated_query_params` (non-unique): migrated_query_params — **low selectivity**

### `brightlocal.ct2_ct_citations` — XL, ~99M rows, 37 GB

- `PRIMARY` (unique): ct_citation_id
- `idx_competitor_id` (non-unique): competitor_id — **low selectivity**
- `idx_domain` (non-unique): domain
- `idx_report_id_domain` (unique): report_id, domain
- `idx_report_run_id` (non-unique): report_run_id

### `brightlocal.ct_competitor_citations` — XL, ~190M rows, 35 GB

- `PRIMARY` (unique): id
- `competitor_domain` (unique): competitor_id, domain
- `competitor_id` (non-unique): competitor_id

### `brightlocal.change_log` — XL, ~4.7M rows, 35 GB

- `PRIMARY` (unique): id
- `idx_customer_id_event_type` (non-unique): customer_id, event_type
- `idx_customer_id_tool` (non-unique): customer_id, tool

### `brightlocal.scu_report_runs_data` — XL, ~420k rows, 27 GB

- `PRIMARY` (unique): report_id, report_run_id

### `brightlocal.lsrc_summary_stats` — XL, ~81M rows, 24 GB

- `PRIMARY` (unique): customer_id, campaign_id, campaign_history_id, search_engine
- `idx_campaign_history_id` (non-unique): campaign_history_id
- `idx_campaign_id` (non-unique): campaign_id
- `idx_campaign_search_engine_latest_lookup` (non-unique): campaign_id, search_engine, is_latest_scheduled
- `idx_lsrc_ss_lookup` (non-unique): customer_id, campaign_history_id, search_engine

### `brightlocal.ct2_ct_citations_url` — XL, ~93M rows, 19 GB

- `PRIMARY` (unique): id
- `ct_citation_id` (non-unique): citation_id

### `brightlocal.cb_campaign_citations` — XL, ~46M rows, 17 GB

- `PRIMARY` (unique): campaign_citation_id
- `campaign_citation` (unique): campaign_id, citation_id, citation, secondary_campaign_id
- `campaign_id` (non-unique): campaign_id
- `citation_id` (non-unique): citation_id
- `citation_id_status` (non-unique): citation_id, status
- `idx_campaign_secondary_citation` (unique): campaign_id, citation_id, secondary_campaign_id
- `idx_date_submitted` (non-unique): date_submitted
- `is_custom` (non-unique): is_custom
- `pre_status` (non-unique): pre_status
- `status` (non-unique): status
- `url` (non-unique): url

### `brightlocal.location_summary_report_summaries` — XL, ~9.5M rows, 15 GB

- `PRIMARY` (unique): id
- `fk_location_summary_report_summaries_report_type` (non-unique): report_type_id — **low selectivity**
- `idx_report_summaries_customer` (non-unique): customer_id
- `idx_report_summaries_location` (non-unique): location_id
- `uniq_report_identifier` (unique): report_id, report_type_id, report_creation_timestamp

### `brightlocal.lm_external_updates` — XL, ~14M rows, 13 GB

- `PRIMARY` (unique): id
- `ext_upd_unique_idx` (unique): location_id, source, field, created_at
- `idx_alert_processing` (non-unique): status, email_alert_triggered, created_at
- `idx_customer_id` (non-unique): customer_id
- `idx_lm_external_update_uuid` (unique): uuid
- `location_idx` (non-unique): location_id

### `brightlocal.active_sync_updates` — XL, ~1.8M rows, 12 GB

- `PRIMARY` (unique): id
- `idx_active_sync_updates_source_created_at_status` (non-unique): source, created_at, status
- `idx_active_sync_updates_status` (non-unique): status — **low selectivity**
- `idx_location_uuid` (non-unique): location_uuid
- `idx_request_uuid` (non-unique): request_uuid
- `unique_request_uuid_location_uuid_source` (unique): request_uuid, location_uuid, source

### `brightlocal.braintree_payment_process_flow_log` — XL, ~590k rows, 9.5 GB

- `PRIMARY` (unique): id
- `idx_customer_id` (non-unique): customer_id

### `brightlocal.api_key_request_logs` — XL, ~43M rows, 8.2 GB

- `PRIMARY` (unique): request_log_id
- `idx_access_date` (non-unique): access_date
- `idx_api_key` (non-unique): api_key
- `idx_ip_address` (non-unique): ip_address

### `brightlocal.subscription_tool_event_log` — XL, ~45M rows, 8.1 GB

- `PRIMARY` (unique): id
- `customer_id_idx` (non-unique): customer_id, created_at, status, type
- `report_id_idx` (non-unique): report_id

### `brightlocal.schedule_block_items` — XL, ~48M rows, 8.1 GB

- `PRIMARY` (unique): id
- `idx_block` (non-unique): block_id
- `idx_block_status` (non-unique): block_id, status

### `brightlocal.cb_data_history` — XL, ~440k rows, 8.1 GB

- `PRIMARY` (unique): data_history_id
- `campaign_id_idx` (non-unique): campaign_id

### `brightlocal.rm_gmb_review_run_errors` — XL, ~1.9M rows, 6.6 GB

- `PRIMARY` (unique): id
- `run_review_id` (non-unique): run_review_id

### `brightlocal.rf_report_runs` — XL, ~63M rows, 6.6 GB

- `PRIMARY` (unique): report_run_id
- `dt` (non-unique): dt
- `report_id` (non-unique): report_id

### `brightlocal.lsrc_ranking_positions_by_history` — XL, ~88M rows, 6.1 GB

- `PRIMARY` (unique): campaign_id, campaign_history_id, search_engine

### `brightlocal.cb_data` — XL, ~240k rows, 5.4 GB

- `campaign_id` (unique): campaign_id

### `brightlocal.moz_ranking` — XL, ~30M rows, 5 GB

- `PRIMARY` (unique): id
- `idx_last_updated` (non-unique): updated_at
- `url` (unique): url

### `brightlocal.cl_customer_locations` — L, ~1.5M rows, 4.5 GB

- `PRIMARY` (unique): location_id
- `client_id` (non-unique): customer_id, client_id, is_removed
- `customer_name_ref` (non-unique): customer_id, name, reference_number
- `idx_gmb_location_id` (non-unique): gmb_location_id
- `idx_google_api_place_id` (non-unique): google_api_place_id
- `idx_google_place_id` (non-unique): google_place_id
- `old_client_id` (non-unique): old_client_id
- `uuid_idx` (unique): uuid

### `brightlocal.lsrc_ranking_positions_by_history_split` — XL, ~46M rows, 4.1 GB

- `PRIMARY` (unique): campaign_id, campaign_history_id, search_engine

### `brightlocal.rf_directories` — L, ~3.7M rows, 4 GB

- `PRIMARY` (unique): id
- `report_directory_idx` (unique): directory, report_id
- `report_id` (non-unique): report_id
- `url` (non-unique): url
- `use` (non-unique): use — **low selectivity**

### `brightlocal.ct_report_domains` — XL, ~19M rows, 3.8 GB

- `PRIMARY` (unique): report_domain_id
- `competitor_id` (non-unique): competitor_id
- `idx_domain` (non-unique): domain
- `report_id` (non-unique): report_run_id

### `brightlocal.rf_reviews_yelp_backup` — L, ~4.5M rows, 3.8 GB

- `PRIMARY` (unique): review_id

### `brightlocal.lsrc_ru_report_search_term_rankings` — L, ~7.6M rows, 3.4 GB

- `PRIMARY` (unique): search_term_ranking_id
- `idx_customer_id` (non-unique): customer_id — **low selectivity**
- `idx_ru_report_id_keyword_loc_unique` (unique): ru_report_id, keyword, location
- `ru_report_id_indx` (non-unique): ru_report_id
- `ru_report_id_keyword_indx` (non-unique): ru_report_id, keyword

### `brightlocal.gpw_screenshots` — XL, ~16M rows, 2.8 GB

- `PRIMARY` (unique): id
- `gpw_search_term_id` (non-unique): gpw_search_term_id

### `brightlocal.ct_report_runs` — XL, ~10M rows, 2.7 GB

- `PRIMARY` (unique): report_run_id
- `idx_created` (non-unique): created
- `idx_customer_status_scheduled_counted_created` (non-unique): customer_id, is_scheduled, is_counted, status, created
- `idx_processed` (non-unique): processed
- `idx_report_id_created` (non-unique): report_id, created
- `idx_status_cancel_run` (non-unique): status, cancel_run — **low selectivity**
- `report_id` (non-unique): report_id

### `brightlocal.cb_indexing_services_links` — L, ~8.5M rows, 2.7 GB

- `PRIMARY` (unique): id
- `idx_service_processed_at` (non-unique): service, processed_at
- `idx_url_service` (non-unique): url, service

### `brightlocal.lsrc_search_query_summaries` — XL, ~18M rows, 2.5 GB

- `PRIMARY` (unique): log_id
- `idx_campaign_id` (non-unique): campaign_id
- `idx_customer_id` (non-unique): customer_id
- `idx_query_date` (non-unique): query_date
- `idx_unique` (unique): customer_id, campaign_id, query_date

### `brightlocal.lsrc_campaign_keywords` — L, ~9.5M rows, 2.3 GB

- `PRIMARY` (unique): keyword_id
- `campaign_term` (unique): campaign_id, keyword
- `keyword_idx` (non-unique): keyword

### `brightlocal.braintree_webhook_inbox` — L, ~38k rows, 2 GB

- `PRIMARY` (unique): notification_id
- `idx_bt_inbox_kind` (non-unique): kind
- `idx_bt_inbox_processing_started` (non-unique): status, processing_started_at
- `idx_bt_inbox_status_processed` (non-unique): status, processed_at
- `idx_bt_inbox_status_received` (non-unique): status, received_at
- `idx_bt_inbox_subject_kind_id` (non-unique): subject_kind_id

### `brightlocal.profile_batch` — L, ~2.7M rows, 2 GB

- `PRIMARY` (unique): id

### `brightlocal.customer_subscriptions_snapshots` — L, ~230k rows, 1.9 GB

- `PRIMARY` (unique): id
- `customer_id` (non-unique): customer_id

### `brightlocal.local_brain_report_snapshots` — L, ~62k rows, 1.8 GB

- `PRIMARY` (unique): id
- `idx_customer_location_report` (unique): customer_id, location_id, report_type

### `brightlocal.listing_pf_request_logs` — L, ~620k rows, 1.7 GB

- `PRIMARY` (unique): id
- `unique_location_uuid` (non-unique): location_uuid

### `brightlocal.open_ai_requests` — L, ~410k rows, 1.7 GB

- `PRIMARY` (unique): id
- `idx_customer_initiator_created` (non-unique): customer_id, initiator, created_at

### `brightlocal.gmb_location_additional_data` — L, ~230k rows, 1.6 GB

- `PRIMARY` (unique): id
- `unique_location_uuid` (unique): location_uuid

### `brightlocal.lsrc_unblended_ranking_positions_by_history` — XL, ~32M rows, 1.6 GB

- `PRIMARY` (unique): campaign_id, campaign_history_id, search_engine

### `brightlocal.gmb_media_items` — L, ~2.8M rows, 1.5 GB

- `PRIMARY` (unique): id
- `gmb_media_items_location_id_index` (non-unique): location_id

### `brightlocal.grc_keywords_runs` — XL, ~25M rows, 1.5 GB

- `PRIMARY` (unique): keyword_id, run_id
- `run_id` (non-unique): run_id

### `brightlocal.grc_report_runs` — L, ~4.2M rows, 1.5 GB

- `PRIMARY` (unique): id
- `created_at` (non-unique): created_at
- `finished_at` (non-unique): finished_at
- `idx_is_archived` (non-unique): is_archived — **low selectivity**
- `report_id` (non-unique): report_id
- `snapshot_id` (non-unique): snapshot_id
- `st` (non-unique): status — **low selectivity**
- `uuid` (unique): uuid

### `brightlocal.cb_log_citation_submission` — L, ~4.7M rows, 1.5 GB

- `PRIMARY` (unique): id
- `batch_id` (non-unique): batch_id
- `campaign_id` (unique): campaign_id, secondary_id, user_id, campaign_citation_id
- `status` (non-unique): status — **low selectivity**
- `submitted_at_idx` (non-unique): submitted_at
- `unique_campaign_citation_id` (unique): campaign_citation_id
- `user_id` (non-unique): user_id — **low selectivity**
- `user_submitted_idx` (non-unique): user_id, submitted_at

### `brightlocal.gpw_search_competitors` — XL, ~12M rows, 1.4 GB

- `PRIMARY` (unique): search_competitor_id
- `competitor_id` (non-unique): gpw_google_place_history_id
- `idx_search_term_id` (non-unique): search_term_id

### `brightlocal.gpw_customer_reviews` — L, ~3.1M rows, 1.4 GB

- `PRIMARY` (unique): gpw_customer_review_id
- `fk_gpw_customer_history_id` (non-unique): gpw_customer_history_id

### `brightlocal.cl_customer_location_images` — L, ~2.5M rows, 1.4 GB

- `PRIMARY` (unique): id
- `idx_image_hash` (non-unique): image_hash
- `li_location_id_idx` (non-unique): location_id

### `brightlocal.lsrc_campaigns` — L, ~530k rows, 1.1 GB

- `PRIMARY` (unique): campaign_id
- `idx_branding_profile_id` (non-unique): branding_profile_id — **low selectivity**
- `idx_client_id` (non-unique): client_id
- `idx_currently_running` (non-unique): currently_running — **low selectivity**
- `idx_customer_id` (non-unique): customer_id
- `idx_last_message` (non-unique): last_message — **low selectivity**
- `idx_last_processed` (non-unique): last_processed
- `idx_postcode` (non-unique): postcode
- `idx_schedule` (non-unique): schedule — **low selectivity**
- `idx_status` (non-unique): status — **low selectivity**
- `idx_telephone` (non-unique): telephone
- `lsrc_campaigns_red_flag_index` (non-unique): red_flag — **low selectivity**

### `brightlocal.local_brain_insights` — L, ~57k rows, 1 GB

- `PRIMARY` (unique): id
- `idx_customer_location_status` (non-unique): customer_id, location_id, status
- `idx_location_id` (non-unique): location_id
- `idx_status_created` (non-unique): status, created_at

### `brightlocal.scu_report_ld_profile_urls` — L, ~7.4M rows, 1000 MB

- `PRIMARY` (unique): id
- `unique_customer_report_indentifier` (unique): customer_id, report_id, directory_identifier, is_social

### `brightlocal.gpw_report_runs` — L, ~4.9M rows, 1000 MB

- `PRIMARY` (unique): report_run_id
- `idx_created` (non-unique): created
- `idx_is_counted` (non-unique): is_counted — **low selectivity**
- `idx_processed` (non-unique): processed
- `idx_report_id` (non-unique): report_id
- `idx_status` (non-unique): status — **low selectivity**
- `idx_status_cancel_run` (non-unique): status, cancel_run — **low selectivity**

### `brightlocal.rm_showcase_widget_referers` — L, ~3.1M rows, 1000 MB

- `PRIMARY` (unique): id
- `entry_hash` (unique): entry_hash

### `brightlocal.login_logs` — L, ~4.3M rows, 810 MB

- `PRIMARY` (unique): id
- `idx_email_ip_address_status_created_at` (non-unique): email, ip_address, status, created_at

### `brightlocal.lsrc_campaign_history_competitors` — L, ~5M rows, 720 MB

- `PRIMARY` (unique): competitor_id
- `campaign_history_id` (unique): campaign_history_id, competitor_url

### `brightlocal.customer_log` — L, ~4M rows, 690 MB

- `PRIMARY` (unique): log_id
- `customer_id_idx` (non-unique): customer_id
- `tool_idx` (non-unique): log_group — **low selectivity**

### `brightlocal.rm_facebook_review_run_errors` — L, ~3M rows, 650 MB

- `PRIMARY` (unique): id
- `run_review` (non-unique): run_review

### `brightlocal.majestic_rankings` — L, ~4.7M rows, 640 MB

- `PRIMARY` (unique): id
- `idmaj_last_updated` (non-unique): updated_at
- `url` (unique): url

### `brightlocal.ct_competitors_v2` — L, ~3.3M rows, 590 MB

- `PRIMARY` (unique): id
- `report_google_place` (non-unique): report_id, google_place_id
- `report_id` (non-unique): report_id

### `brightlocal.free_tool_request_logs` — L, ~3.3M rows, 550 MB

- `PRIMARY` (unique): id
- `created_at_index` (non-unique): created_at
- `ip_tool_index` (non-unique): ip_address, tool

### `brightlocal.location_dashboard_settings` — L, ~2M rows, 540 MB

- `PRIMARY` (unique): settings_id
- `idx_access_key` (non-unique): access_key
- `idx_uniq_location_id` (unique): location_id
- `location_dashboard_settings_white_label_profiles_id_fk` (non-unique): white_label_profile_id

### `brightlocal.ct_nap_status_summaries` — L, ~3.1M rows, 540 MB

- `PRIMARY` (unique): id
- `summary_type` (unique): report_id, type

### `brightlocal.planhat_relations` — L, ~1.5M rows, 530 MB

- `PRIMARY` (unique): id
- `bl_id_type` (unique): bl_id, type
- `planhat_id` (non-unique): planhat_id

### `brightlocal.cl_website_metrics_history` — L, ~2.5M rows, 530 MB

- `PRIMARY` (unique): id
- `cl_website_metrics_history_location_id_index` (non-unique): location_id
- `idx_website_hash` (non-unique): website_hash

### `brightlocal.google_place_citations_summary` — L, ~6.5M rows, 500 MB

- `PRIMARY` (unique): id
- `google_place_id` (unique): google_place_id

### `brightlocal.customer_credits_usages` — L, ~2.3M rows, 440 MB

- `PRIMARY` (unique): id
- `idx_customer_type` (non-unique): customer_id, type, created_at

### `brightlocal.ct_report_summary` — L, ~6.6M rows, 430 MB

- `PRIMARY` (unique): report_summary_id
- `report_run_id` (unique): report_run_id

### `brightlocal.email_validation_results` — L, ~1.1M rows, 410 MB

- `PRIMARY` (unique): id
- `email_idx` (non-unique): email

### `brightlocal.cb_campaign_publisher_directories` — L, ~1M rows, 370 MB

- `PRIMARY` (unique): id
- `UC_SITE` (unique): id, directory
- `foreign_key_campaign_network_id` (non-unique): campaign_publisher_id
- `status` (non-unique): status — **low selectivity**

### `brightlocal.rm_contacts` — L, ~1M rows, 360 MB

- `PRIMARY` (unique): id
- `idx_email_list_hash` (non-unique): email_list_hash
- `key` (unique): public_key
- `public_key` (non-unique): public_key
- `rm_contact_list` (non-unique): contact_list_id

### `brightlocal.cb_campaign_changes` — L, ~1.6M rows, 310 MB

- `PRIMARY` (unique): id
- `cb_campaign_changes_campaign_id_fk` (non-unique): campaign_id
- `cb_campaign_changes_user_id_fk` (non-unique): user_id

### `brightlocal.ct_removed_citations_log` — L, ~2M rows, 290 MB

- `PRIMARY` (unique): id
- `idx_report_id` (non-unique): report_id

### `brightlocal.rm_campaign_customers` — L, ~1.3M rows, 250 MB

- `PRIMARY` (unique): id
- `idx_campaign_id_mode_score_point` (non-unique): campaign_id, mode, score_point
- `idx_mode` (non-unique): mode — **low selectivity**
- `idx_report_id` (non-unique): report_id
- `idx_score_type` (non-unique): score_type — **low selectivity**
- `idx_template_id` (non-unique): template_id

### `brightlocal.cl_reports_count` — L, ~2.7M rows, 240 MB

- `PRIMARY` (unique): id
- `location_id` (unique): location_id, tool

### `brightlocal.cb_citations_url` — L, ~1.8M rows, 240 MB

- `PRIMARY` (unique): id
- `ct_citation_id` (non-unique): citation_id

### `brightlocal.gpw_search_terms` — L, ~1.5M rows, 220 MB

- `PRIMARY` (unique): search_term_id
- `idx_search_term` (non-unique): report_run_id, search_term
- `report_run_id` (non-unique): report_run_id

### `brightlocal.location_dashboard_wl_tool_availability` — L, ~2.2M rows, 190 MB

- `PRIMARY` (unique): id
- `idx_is_active` (non-unique): is_active — **low selectivity**
- `settings_id` (unique): settings_id, tool_code

### `brightlocal.rm_campaign_events` — L, ~1.8M rows, 180 MB

- `PRIMARY` (unique): id
- `campaign_contact_event` (non-unique): campaign_id, contact_id

### `brightlocal.grc_report_keywords` — L, ~1.9M rows, 160 MB

- `PRIMARY` (unique): id
- `report_id` (non-unique): report_id

### `brightlocal.user_ip_logs` — L, ~1.2M rows, 150 MB

- `PRIMARY` (unique): log_id
- `customer_id` (non-unique): customer_id
- `last_seen` (non-unique): last_seen
- `user_id` (unique): user_id, ip_address

### `brightlocal.cb_campaign_sent_notifications` — L, ~1.7M rows, 140 MB

- `PRIMARY` (unique): id
- `uq_campaign_notification_type` (unique): campaign_id, secondary_id, notification_event
