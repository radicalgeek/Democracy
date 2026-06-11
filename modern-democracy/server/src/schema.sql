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
