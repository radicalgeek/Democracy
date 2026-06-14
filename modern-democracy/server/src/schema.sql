-- Democracy core schema. Applied idempotently at boot (db.ts).
-- Identity is deliberately separated from ballots: credential_issuances records
-- THAT a user received a credential for a bill; voting_credentials stores only
-- the credential hash with no user reference; anonymous_ballots reference the
-- credential's constituency claim, never a user.

create table if not exists data_import_runs (
  id bigserial primary key,
  kind text not null,
  status text not null default 'running',
  detail jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists parties (
  id integer primary key,
  name text not null,
  abbreviation text,
  background_colour text
);

create table if not exists constituencies (
  id integer primary key,
  name text not null,
  normalized_name text not null,
  start_date date,
  end_date date,
  imported_at timestamptz not null default now()
);
create index if not exists constituencies_normalized_idx on constituencies (normalized_name);

create table if not exists representatives (
  id integer primary key,
  name text not null,
  party_id integer references parties(id),
  constituency_id integer references constituencies(id),
  gender text,
  thumbnail_url text,
  imported_at timestamptz not null default now()
);

-- Binding between the accurate legacy SVG (2010-era boundaries) and current
-- canonical constituency records. match_status records honesty about boundary drift.
create table if not exists svg_seat_bindings (
  svg_id text primary key,
  legacy_name text not null,
  legacy_party text,
  constituency_id integer references constituencies(id),
  match_status text not null check (match_status in ('exact', 'normalized', 'unmatched')),
  matched_at timestamptz not null default now()
);

create table if not exists bills (
  id integer primary key,
  short_title text not null,
  long_title text,
  current_house text,
  current_stage text,
  bill_type text,
  is_act boolean not null default false,
  is_defeated boolean not null default false,
  last_updated timestamptz,
  source_url text,
  imported_at timestamptz not null default now()
);

create table if not exists bill_events (
  id bigserial primary key,
  bill_id integer not null references bills(id),
  stage text,
  house text,
  happened_on date,
  raw jsonb not null default '{}'::jsonb,
  unique (bill_id, stage, house, happened_on)
);

create table if not exists bill_texts (
  id bigserial primary key,
  bill_id integer not null references bills(id),
  publication_id integer,
  title text,
  content_type text,
  source_url text,
  text_content text,
  fetched_at timestamptz not null default now(),
  unique (bill_id, publication_id)
);

create table if not exists users (
  id bigserial primary key,
  display_name text not null,
  token_hash text not null unique,
  constituency_id integer references constituencies(id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- Account fields (added after the anonymous-session prototype). Anonymous/demo
-- rows keep email null; registered accounts get email+password and a
-- verification tier: 0 = anonymous, 1 = registered (postcode-resolved
-- constituency), 2 = identity-verified (simulated provider for now).
alter table users add column if not exists email text;
alter table users add column if not exists password_hash text;
alter table users add column if not exists postcode text;
alter table users add column if not exists verification_tier integer not null default 0;
alter table users add column if not exists verified_at timestamptz;
create unique index if not exists users_email_idx on users (lower(email)) where email is not null;

create table if not exists credential_issuances (
  id bigserial primary key,
  user_id bigint not null references users(id),
  bill_id integer not null references bills(id),
  issued_at timestamptz not null default now(),
  unique (user_id, bill_id)
);

create table if not exists voting_credentials (
  id bigserial primary key,
  credential_hash text not null unique,
  bill_id integer not null references bills(id),
  constituency_id integer references constituencies(id),
  spent boolean not null default false,
  issued_at timestamptz not null default now(),
  spent_at timestamptz
);

create table if not exists anonymous_ballots (
  id bigserial primary key,
  bill_id integer not null references bills(id),
  constituency_id integer references constituencies(id),
  choice text not null check (choice in ('for', 'against', 'abstain')),
  leaf_hash text not null unique,
  salt text not null,
  cast_at timestamptz not null default now()
);
create index if not exists ballots_bill_idx on anonymous_ballots (bill_id, id);

create table if not exists vote_receipts (
  id bigserial primary key,
  receipt_code text not null unique,
  bill_id integer not null,
  leaf_hash text not null,
  issued_at timestamptz not null default now()
);

create table if not exists append_only_events (
  seq bigserial primary key,
  event_type text not null,
  payload jsonb not null,
  prev_hash text not null,
  event_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists checkpoints (
  id bigserial primary key,
  bill_id integer not null references bills(id),
  merkle_root text not null,
  ballot_count integer not null,
  event_seq bigint not null,
  prev_checkpoint_hash text,
  checkpoint_hash text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists checkpoints_bill_idx on checkpoints (bill_id, id desc);

create table if not exists debate_posts (
  id bigserial primary key,
  bill_id integer not null references bills(id),
  user_id bigint not null references users(id),
  stance text check (stance in ('for', 'against', 'abstain')),
  body text not null,
  moderation_state text not null default 'needs-review'
    check (moderation_state in ('clean', 'heated-legitimate', 'needs-review', 'hidden', 'blocked')),
  created_at timestamptz not null default now()
);
create index if not exists debate_bill_idx on debate_posts (bill_id, id desc);

create table if not exists moderation_actions (
  id bigserial primary key,
  post_id bigint references debate_posts(id),
  user_id bigint references users(id),
  action text not null,
  reason text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists temporary_bans (
  id bigserial primary key,
  user_id bigint not null references users(id),
  ban_number integer not null,
  reason text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null
);
create index if not exists bans_user_idx on temporary_bans (user_id, ends_at desc);

create table if not exists ai_analyses (
  id bigserial primary key,
  subject_type text not null,
  subject_id text not null,
  kind text not null,
  model text not null,
  prompt_version text not null,
  source_hash text not null,
  output jsonb not null,
  citations jsonb not null default '[]'::jsonb,
  confidence real,
  review_state text not null default 'unreviewed',
  generated_at timestamptz not null default now()
);
create index if not exists ai_subject_idx on ai_analyses (subject_type, subject_id, kind, id desc);

-- Commons divisions: how MPs actually voted, from the official Commons Votes
-- API. division_votes.member_id is intentionally not a foreign key — division
-- lists can include members who have since left the House.
create table if not exists divisions (
  id integer primary key,
  title text not null,
  date timestamptz,
  number integer,
  aye_count integer not null default 0,
  no_count integer not null default 0,
  bill_id integer references bills(id),
  imported_at timestamptz not null default now()
);
create index if not exists divisions_bill_idx on divisions (bill_id);

create table if not exists division_votes (
  division_id integer not null references divisions(id),
  member_id integer not null,
  vote text not null check (vote in ('aye', 'no')),
  primary key (division_id, member_id)
);
create index if not exists division_votes_member_idx on division_votes (member_id, division_id desc);

-- Petitions imported from petition.parliament.uk. Unlike bill ballots,
-- petition votes are account-linked (one per user, like a public petition
-- signature) — only aggregates are ever published.
create table if not exists petitions (
  id integer primary key,
  action text not null,
  background text,
  additional_details text,
  state text not null,
  signature_count integer not null default 0,
  opened_at timestamptz,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists petition_votes (
  petition_id integer not null references petitions(id),
  user_id bigint not null references users(id),
  choice text not null check (choice in ('for', 'against', 'abstain')),
  cast_at timestamptz not null default now(),
  primary key (petition_id, user_id)
);

-- Debate generalized to petitions: posts attach to a bill OR a petition.
alter table debate_posts add column if not exists petition_id integer references petitions(id);
alter table debate_posts alter column bill_id drop not null;
create index if not exists debate_petition_idx on debate_posts (petition_id, id desc);

-- Rich member/constituency data fetched lazily from the Members API and
-- cached as JSONB (refreshed when stale) — keeps import cycles light while
-- letting detail pages be as rich as the upstream API allows.
create table if not exists member_profiles (
  member_id integer primary key,
  synopsis text,
  membership_start date,
  biography jsonb,
  latest_election jsonb,
  fetched_at timestamptz not null default now()
);

create table if not exists constituency_election_cache (
  constituency_id integer primary key,
  elections jsonb not null,
  fetched_at timestamptz not null default now()
);

-- News groundwork (ingestion is a later milestone)
create table if not exists news_sources (
  id bigserial primary key,
  name text not null unique,
  homepage_url text,
  feed_url text
);

create table if not exists news_items (
  id bigserial primary key,
  source_id bigint references news_sources(id),
  title text not null,
  url text not null unique,
  published_at timestamptz,
  summary text,
  fetched_at timestamptz not null default now()
);

create table if not exists news_bill_links (
  news_item_id bigint not null references news_items(id),
  bill_id integer not null references bills(id),
  primary key (news_item_id, bill_id)
);

create table if not exists news_petition_links (
  news_item_id bigint not null references news_items(id),
  petition_id integer not null references petitions(id),
  primary key (news_item_id, petition_id)
);

-- Gamification: help topic views
create table if not exists user_help_views (
  user_id bigint not null references users(id),
  topic_id text not null,
  viewed_at timestamptz default now(),
  unique (user_id, topic_id)
);
create index if not exists user_help_views_user_idx on user_help_views (user_id);

-- Gamification: achievements
create table if not exists user_achievements (
  id bigserial primary key,
  user_id bigint not null references users(id),
  achievement_id text not null,
  unlocked_at timestamptz default now(),
  condition_progress jsonb default '{}',
  unique (user_id, achievement_id)
);
create index if not exists user_achievements_user_idx on user_achievements (user_id);

-- Gamification: engagement stats (daily snapshot)
create table if not exists user_engagement_stats (
  id bigserial primary key,
  user_id bigint not null references users(id),
  period_date date not null,
  bills_voted_cumulative int default 0,
  debate_posts_cumulative int default 0,
  constituencies_explored int default 0,
  help_topics_viewed_cumulative int default 0,
  current_streak int default 0,
  current_engagement_level text default 'inactive'
    check (current_engagement_level in ('inactive', 'curious', 'engaged', 'committed', 'scholar')),
  learning_achievements jsonb default '[]',
  created_at timestamptz default now(),
  unique (user_id, period_date)
);
create index if not exists engagement_stats_user_idx on user_engagement_stats (user_id, period_date desc);
create index if not exists engagement_stats_period_idx on user_engagement_stats (period_date);

-- Civic data expansion spine: source registry, local-government layers,
-- fiscal/tax explainers, compass scoring, and aggregate views. These tables
-- intentionally start source-first so every future ingestion can explain
-- provenance, caveats, newcomer value, compass potential, and aggregate use.
create table if not exists source_registry (
  id text primary key,
  name text not null,
  category text not null,
  scope text not null,
  owner text not null,
  url text not null,
  licence text,
  official_status text not null,
  refresh_cadence text,
  newcomer_explanation text not null,
  compass_score_potential text not null,
  aggregate_view_potential text not null,
  caveats text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists source_registry_category_idx on source_registry (category);

create table if not exists local_civic_layers (
  id text primary key,
  title text not null,
  layer_type text not null,
  summary text not null,
  source_id text references source_registry(id),
  beginner_label text not null,
  gamified_action text,
  compass_potential text,
  aggregate_view text not null,
  status text not null default 'planned',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists fiscal_indicators (
  id text primary key,
  title text not null,
  plain_english text not null,
  source_id text references source_registry(id),
  period text,
  value_label text,
  trend_label text,
  why_it_matters text not null,
  compass_potential text,
  aggregate_view text not null,
  status text not null default 'planned',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists tax_scenarios (
  id text primary key,
  title text not null,
  persona text not null,
  plain_english text not null,
  source_ids text[] not null default array[]::text[],
  visible_pattern text not null,
  compass_potential text,
  aggregate_view text not null,
  status text not null default 'planned',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists compass_scores (
  id bigserial primary key,
  subject_type text not null,
  subject_id text not null,
  x numeric(6,2) not null,
  y numeric(6,2) not null,
  label text not null,
  explanation text not null,
  confidence real not null default 0,
  source_id text references source_registry(id),
  method text not null default 'seeded-product-rubric',
  generated_at timestamptz not null default now(),
  unique (subject_type, subject_id, method)
);
create index if not exists compass_scores_subject_idx on compass_scores (subject_type, subject_id);

create table if not exists aggregate_views (
  id text primary key,
  title text not null,
  view_type text not null,
  summary text not null,
  source_ids text[] not null default array[]::text[],
  beginner_question text not null,
  compass_lens text,
  route_hint text,
  status text not null default 'planned',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Parliamentary debates pulled from the official Hansard API, linked to the
-- bill they discuss. text_content holds the cleaned contribution transcript
-- used as the AI debate-summary source.
create table if not exists bill_debates (
  id bigserial primary key,
  bill_id integer not null references bills(id),
  ext_id text not null unique,
  title text not null,
  house text,
  sitting_date date,
  contributions integer not null default 0,
  speakers integer not null default 0,
  text_content text,
  source_url text not null,
  imported_at timestamptz not null default now()
);
create index if not exists bill_debates_bill_idx on bill_debates (bill_id, sitting_date desc);

-- Per-speaker breakdown of a debate: [{ memberId, name, contributions, words }],
-- sorted by words desc. Captures who spoke and how much of the floor they took
-- (Hansard publishes no timecodes, so word share is the "talked out the clock"
-- signal). Member ids join to representatives, the revealed-preference compass,
-- and member_interests_cache.
alter table bill_debates add column if not exists speaker_breakdown jsonb;

-- Lazy caches for per-member registered interests (official Interests API)
-- and department profiles (gov.uk organisations + Members API posts).
create table if not exists member_interests_cache (
  member_id integer primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create table if not exists department_cache (
  slug text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Party + house for any member id, from the Members API. The representatives
-- table is Commons-only, so this is how debate speakers who are peers get a
-- party chip and the right House. Lazy per-member cache, like interests.
create table if not exists member_party_cache (
  member_id integer primary key,
  party_name text,
  party_abbreviation text,
  party_colour text,
  house text,
  fetched_at timestamptz not null default now()
);

-- Public opinion polling from free, openly-licensed sources (BritPolls CC BY
-- 4.0, Wikipedia CC BY-SA). Ingested on every worker cycle; each poll upserts
-- by (pollster, fieldwork_end, scope) so re-fetching the stable source URLs
-- accumulates a time-series rather than overwriting. Polling is a SEPARATE,
-- clearly-labelled comparison layer — it is never merged into the
-- anonymous-ballot civic will, which is revealed preference.
create table if not exists polls (
  id bigserial primary key,
  source text not null,
  pollster text not null,
  fieldwork_end date not null,
  sample_size integer,
  method text,
  scope text not null default 'GB',
  is_poll_of_polls boolean not null default false,
  source_url text,
  fetched_at timestamptz not null default now(),
  unique (pollster, fieldwork_end, scope)
);
create index if not exists polls_fieldwork_idx on polls (fieldwork_end desc);
create index if not exists polls_pop_idx on polls (is_poll_of_polls, fieldwork_end desc);

create table if not exists poll_results (
  poll_id bigint not null references polls(id) on delete cascade,
  party_code text not null,
  party_label text not null,
  percent numeric(5,2) not null,
  primary key (poll_id, party_code)
);

create table if not exists leader_approval (
  id bigserial primary key,
  leader text not null,
  party_code text,
  approve numeric(5,2),
  disapprove numeric(5,2),
  net numeric(6,2),
  as_of date not null,
  source text not null,
  source_url text,
  fetched_at timestamptz not null default now(),
  unique (leader, as_of, source)
);

-- Modelled MRP constituency projections (Survation, More in Common, Focaldata,
-- Ipsos, YouGov). Imported semi-automatically via the admin endpoint — there is
-- no free stable feed, so these refresh when a new MRP is published, captioned
-- as modelled estimates. Names matched to current constituencies via the same
-- normalization the SVG bindings use; unmatched rows are kept, not hidden.
create table if not exists mrp_estimates (
  id bigserial primary key,
  constituency_id integer references constituencies(id),
  constituency_name text not null,
  source text not null,
  released_on date not null,
  party_code text not null,
  party_label text not null,
  percent numeric(5,2),
  projected_winner boolean not null default false,
  match_status text not null default 'unmatched',
  fetched_at timestamptz not null default now(),
  unique (source, released_on, constituency_name, party_code)
);
create index if not exists mrp_constituency_idx on mrp_estimates (constituency_id);
create index if not exists mrp_release_idx on mrp_estimates (source, released_on desc);

-- News linked to the MPs and parties it mentions, plus a per-article media
-- assessment: editorial lean (bias of the framing), factual framing, a
-- sensationalism estimate, and cross-outlet corroboration. Factual reliability
-- blends framing + corroboration + the outlet's observed track record.
-- IMPORTANT: integrity/conduct scores NEVER use any of this — they are built
-- only from verifiable conduct (voting, declared interests, official records),
-- so hostile or coordinated coverage can never drive a person's score.
create table if not exists news_member_links (
  news_item_id bigint not null references news_items(id),
  member_id integer not null,
  primary key (news_item_id, member_id)
);
create index if not exists news_member_idx on news_member_links (member_id);

create table if not exists news_party_links (
  news_item_id bigint not null references news_items(id),
  party_id integer not null references parties(id),
  primary key (news_item_id, party_id)
);
create index if not exists news_party_idx on news_party_links (party_id);

create table if not exists news_assessments (
  news_item_id bigint primary key references news_items(id),
  bias numeric(5,2),            -- editorial lean of the framing, -10 left .. +10 right
  framing text,                 -- 'fact' | 'allegation' | 'opinion' | 'mixed'
  sensational numeric(4,2),     -- 0 measured .. 1 sensational
  corroborating_outlets int not null default 0,
  factual_score numeric(5,2),   -- 0..100 blended reliability
  factual_label text,           -- 'well-corroborated' | 'contested' | 'single-source' | 'opinion'
  model text,
  confidence real,
  generated_at timestamptz not null default now()
);

-- Observed factual track record per outlet, aggregated from its assessments.
alter table news_sources add column if not exists factual_reliability numeric(5,2);
alter table news_sources add column if not exists reliability_sample integer not null default 0;

-- Recurring narratives shaping the conversation, refreshed each run.
create table if not exists media_narratives (
  id bigserial primary key,
  narrative text not null,
  summary text not null,
  lean_x numeric(5,2),
  lean_y numeric(5,2),
  factual_label text,
  outlets text[] not null default array[]::text[],
  article_count int not null default 0,
  generated_at timestamptz not null default now()
);
