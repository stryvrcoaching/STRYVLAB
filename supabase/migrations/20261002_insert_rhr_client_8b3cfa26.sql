/* Insert RHR measurements for client 2e33b381-0e74-4e8d-828a-a853ed6fd9f0. */
INSERT INTO client_daily_checkins (
  client_id,
  date,
  flow_type,
  rhr_morning
) VALUES
  ('2e33b381-0e74-4e8d-828a-a853ed6fd9f0', '2026-05-23', 'morning', 79),
  ('2e33b381-0e74-4e8d-828a-a853ed6fd9f0', '2026-05-25', 'morning', 85),
  ('2e33b381-0e74-4e8d-828a-a853ed6fd9f0', '2026-05-26', 'morning', 73),
  ('2e33b381-0e74-4e8d-828a-a853ed6fd9f0', '2026-05-27', 'morning', 94),
  ('2e33b381-0e74-4e8d-828a-a853ed6fd9f0', '2026-05-28', 'morning', 72),
  ('2e33b381-0e74-4e8d-828a-a853ed6fd9f0', '2026-05-29', 'morning', 82)
ON CONFLICT (client_id, date, flow_type)
DO UPDATE SET rhr_morning = EXCLUDED.rhr_morning;
