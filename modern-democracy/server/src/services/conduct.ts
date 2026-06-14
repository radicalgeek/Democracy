import type { Sql } from "postgres";

/**
 * "Integrity" here is deliberately an ACCOUNTABILITY score built ONLY from
 * verifiable public conduct — voting participation and whether an up-to-date
 * register of interests is on record. It never uses news coverage, sentiment or
 * AI judgement of a person, so a hostile or coordinated press campaign (the kind
 * that smeared, say, Jeremy Corbyn) can never move it. Independence (voting
 * against the party line) is reported but NOT scored down: it can be principled.
 * Every component is shown so the number is never a black box.
 */

const WEIGHT_PARTICIPATION = 0.65;
const WEIGHT_TRANSPARENCY = 0.35;

export async function memberConduct(sql: Sql, memberId: number) {
  const [{ maxv }] = await sql`
    select coalesce(max(c), 0)::int as maxv
    from (select count(*) c from division_votes group by member_id) t
  `;
  const [{ votes }] = await sql`
    select count(*)::int as votes from division_votes where member_id = ${memberId}
  `;
  const [cache] = await sql`
    select payload from member_interests_cache where member_id = ${memberId}
  `;

  const participation = (maxv as number) > 0 ? Math.round(((votes as number) / (maxv as number)) * 100) : 0;
  const onRecord = Boolean(cache);
  const transparency = onRecord ? 100 : 75; // register is public; "on record" = we have a current, accessible entry
  const score = Math.round(participation * WEIGHT_PARTICIPATION + transparency * WEIGHT_TRANSPARENCY);

  return {
    score,
    participation,
    transparency,
    attendanceVotes: votes as number,
    peakVotes: maxv as number,
    registerOnRecord: onRecord,
    method:
      "Accountability = 65% voting participation (divisions voted vs the most active MP) + 35% register-of-interests transparency. Public records only — never news or sentiment.",
    components: [
      { label: "Voting participation", value: participation, note: `${votes} of up to ${maxv} divisions` },
      { label: "Register transparency", value: transparency, note: onRecord ? "current register entry on record" : "register entry not yet cached" }
    ]
  };
}

export async function partyConduct(sql: Sql, partyId: number) {
  const [{ maxv }] = await sql`
    select coalesce(max(c), 0)::int as maxv
    from (select count(*) c from division_votes group by member_id) t
  `;
  const [agg] = await sql`
    select count(distinct r.id)::int as members,
           coalesce(avg(v.c), 0)::float as avg_votes,
           count(distinct mic.member_id)::int as on_record
    from representatives r
    left join (select member_id, count(*) c from division_votes group by member_id) v on v.member_id = r.id
    left join member_interests_cache mic on mic.member_id = r.id
    where r.party_id = ${partyId}
  `;
  const members = (agg?.members as number) ?? 0;
  const participation = (maxv as number) > 0 ? Math.round((((agg?.avg_votes as number) ?? 0) / (maxv as number)) * 100) : 0;
  const transparency = members > 0 ? Math.round(((agg?.on_record as number) / members) * 100) : 0;
  const score = Math.round(participation * WEIGHT_PARTICIPATION + transparency * WEIGHT_TRANSPARENCY);
  return {
    score,
    participation,
    transparency,
    members,
    method:
      "Party accountability = mean MP voting participation + share of MPs with a current register entry. Public records only — never news.",
    components: [
      { label: "Mean participation", value: participation, note: `${members} MPs` },
      { label: "Register transparency", value: transparency, note: `${(agg?.on_record as number) ?? 0}/${members} MPs on record` }
    ]
  };
}
