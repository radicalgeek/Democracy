import type { Sql } from "postgres";

/**
 * Party + House for any member id, from the official Members API. The
 * representatives table only holds Commons MPs, so this fills the gap for peers
 * who speak in bill debates. Cached per member; a stale row is served if the
 * API is unreachable.
 */

const MEMBERS_API = "https://members-api.parliament.uk/api";
const CACHE_DAYS = 14;

export type MemberParty = {
  memberId: number;
  partyName: string | null;
  partyAbbreviation: string | null;
  partyColour: string | null;
  house: string | null;
};

type MembersApiMember = {
  value?: {
    latestParty?: { name?: string; abbreviation?: string; backgroundColour?: string };
    latestHouseMembership?: { house?: number };
  };
};

/** Members API house enum: 1 = Commons, 2 = Lords. */
function houseLabel(house: number | undefined): string | null {
  if (house === 1) return "Commons";
  if (house === 2) return "Lords";
  return null;
}

async function fetchMemberParty(memberId: number): Promise<MemberParty> {
  const response = await fetch(`${MEMBERS_API}/Members/${memberId}`, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error(`members api returned ${response.status}`);
  const payload = (await response.json()) as MembersApiMember;
  const party = payload.value?.latestParty;
  return {
    memberId,
    partyName: party?.name ?? null,
    partyAbbreviation: party?.abbreviation ?? null,
    partyColour: party?.backgroundColour ?? null,
    house: houseLabel(payload.value?.latestHouseMembership?.house)
  };
}

export async function memberParty(sql: Sql, memberId: number): Promise<MemberParty> {
  const [fresh] = await sql`
    select member_id, party_name, party_abbreviation, party_colour, house
    from member_party_cache
    where member_id = ${memberId} and fetched_at > now() - make_interval(days => ${CACHE_DAYS})
  `;
  if (fresh) {
    return {
      memberId,
      partyName: fresh.party_name as string | null,
      partyAbbreviation: fresh.party_abbreviation as string | null,
      partyColour: fresh.party_colour as string | null,
      house: fresh.house as string | null
    };
  }

  const result = await fetchMemberParty(memberId);
  await sql`
    insert into member_party_cache
      (member_id, party_name, party_abbreviation, party_colour, house, fetched_at)
    values (${memberId}, ${result.partyName}, ${result.partyAbbreviation},
            ${result.partyColour}, ${result.house}, now())
    on conflict (member_id) do update set
      party_name = excluded.party_name,
      party_abbreviation = excluded.party_abbreviation,
      party_colour = excluded.party_colour,
      house = excluded.house,
      fetched_at = now()
  `;
  return result;
}
