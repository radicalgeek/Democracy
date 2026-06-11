import type { Sql } from "postgres";
import { castBallot, createSession, issueCredential, runCheckpoint } from "./integrity.js";
import { moderateAndStorePost } from "./moderation.js";
import { castPetitionVote } from "./petitions.js";

/**
 * Large-scale demo community seeding.
 *
 * Provenance rules (same as seedDemoBallots, scaled up):
 *  - every fabricated participant is a `users.is_demo = true` row, so the
 *    fake cohort is always identifiable in the database;
 *  - ballots are cast ONLY through the real session → credential → ballot →
 *    checkpoint pipeline, never inserted into ballot tables directly;
 *  - debate posts go through the real moderation pipeline;
 *  - a `data_import_runs` row (kind 'demo-community-seed') records exactly
 *    what was fabricated and when. Note: anonymous ballots are unlinkable by
 *    design, so per-ballot demo flags are impossible — the run record holds
 *    the per-bill counts instead.
 *
 * Through the UI nothing is distinguishable from organic activity: names are
 * realistic, vote distributions follow per-constituency political leans that
 * stay consistent across bills, turnout varies by seat, and debate posts are
 * varied stance-aligned prose with timestamps spread over recent weeks.
 */

const USERS_PER_SEAT = Number(process.env.DEMO_COMMUNITY_USERS_PER_SEAT ?? 10);
const BILL_COUNT = Number(process.env.DEMO_COMMUNITY_BILLS ?? 5);
const RNG_SEED = Number(process.env.DEMO_COMMUNITY_RNG_SEED ?? 20260611);

/** Deterministic RNG so reruns on a fresh database produce the same world. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCode(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const FIRST_NAMES = [
  "Oliver", "Amelia", "George", "Isla", "Noah", "Ava", "Arthur", "Mia", "Leo", "Ivy",
  "Oscar", "Freya", "Harry", "Florence", "Archie", "Willow", "Jack", "Sophia", "Charlie", "Grace",
  "Thomas", "Emily", "Henry", "Poppy", "William", "Evie", "Alfie", "Phoebe", "Joshua", "Sienna",
  "James", "Charlotte", "Theo", "Daisy", "Edward", "Alice", "Finley", "Matilda", "Samuel", "Rosie",
  "Daniel", "Eleanor", "Joseph", "Maya", "Adam", "Lucy", "Mohammed", "Aisha", "Omar", "Fatima",
  "Yusuf", "Zara", "Ibrahim", "Layla", "Aaron", "Hannah", "Dylan", "Megan", "Rhys", "Ffion",
  "Owen", "Seren", "Gareth", "Carys", "Evan", "Nia", "Callum", "Eilidh", "Angus", "Isobel",
  "Fraser", "Skye", "Hamish", "Iona", "Ewan", "Mairi", "Cormac", "Niamh", "Declan", "Aoife",
  "Sean", "Orla", "Patrick", "Caitlin", "Liam", "Erin", "Kofi", "Amara", "Tunde", "Chioma",
  "Raj", "Priya", "Arjun", "Anika", "Dev", "Meera", "Kasper", "Lena", "Stefan", "Maria"
];

const LAST_NAMES = [
  "Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Robinson", "Wright",
  "Thompson", "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke",
  "Patel", "Khan", "Begum", "Ali", "Ahmed", "Hussain", "Shah", "Sharma", "Kaur", "Singh",
  "Hughes", "Edwards", "Lewis", "Thomas", "Morgan", "Griffiths", "Owen", "Price", "Rees", "Jenkins",
  "MacDonald", "Campbell", "Stewart", "Murray", "Fraser", "Cameron", "Ross", "Reid", "Grant", "Sinclair",
  "O'Brien", "Murphy", "Kelly", "Ryan", "Byrne", "Gallagher", "Doyle", "McCarthy", "Lynch", "Brennan",
  "Mason", "Carter", "Phillips", "Bennett", "Cooper", "Richardson", "Cox", "Ward", "Foster", "Gray",
  "Mitchell", "Harrison", "Chapman", "Hunt", "Webb", "Palmer", "Holmes", "Mills", "Barnes", "Knight",
  "Okafor", "Adeyemi", "Mensah", "Osei", "Nowak", "Kowalski", "Petrov", "Ivanova", "Costa", "Silva",
  "Chen", "Wang", "Li", "Zhang", "Nguyen", "Tran", "Kim", "Park", "Yamamoto", "Tanaka"
];

/** Stance-aligned debate fragments, composed so no two posts read identically. */
const OPENERS = [
  "Just finished reading the summary of {bill}.",
  "I've been following {bill} since it was introduced.",
  "Watched the second reading debate on this one.",
  "As someone who works in this sector,",
  "Speaking as a parent of two,",
  "I rarely comment on here, but {bill} matters to me.",
  "My constituency will feel this one directly.",
  "Having read the actual text rather than the headlines,",
  "I wrote to my MP about this last week.",
  "This one deserves more attention than it's getting.",
  "Long-time lurker, first post.",
  "I went back and forth on this for days."
];

const FOR_ARGUMENTS = [
  "the case for it is straightforward: the current rules simply aren't working and this is a credible fix.",
  "it's not perfect, but it moves things in the right direction and we shouldn't let perfect be the enemy of good.",
  "the impact assessment makes a strong case, and the costs look manageable compared to doing nothing.",
  "everyone I know affected by this problem has been waiting years for Parliament to act. This is overdue.",
  "the safeguards in the later clauses answer most of the objections people are raising here.",
  "this brings us in line with what most comparable countries already do, and their experience has been positive.",
  "the committee stage evidence was genuinely persuasive — worth reading before voting against."
];

const AGAINST_ARGUMENTS = [
  "the headline aim is fine but the actual mechanism is a blunt instrument that will hit the wrong people.",
  "nobody has explained how this will be funded properly, and unfunded duties just become failures by another name.",
  "the consultation responses were overwhelmingly critical and have mostly been ignored. That's not how this should work.",
  "this hands far too much discretion to ministers through secondary legislation. The detail should be on the face of the bill.",
  "we tried something very similar a decade ago and quietly dropped it because it didn't work.",
  "the burden falls disproportionately on small operators who can least absorb it.",
  "it's a disgrace that this is being rushed through without proper scrutiny of the later schedules."
];

const ABSTAIN_ARGUMENTS = [
  "honestly, there are reasonable points on both sides and the evidence base is thinner than either camp admits.",
  "I want to see the committee amendments before making my mind up. The current draft is too ambiguous.",
  "the principle is right but this draft isn't ready, and I can't back it in this form or oppose it outright.",
  "I'd like to hear more from people directly affected before coming down on either side."
];

const CLOSERS = [
  "Interested in what others here think.",
  "Happy to be persuaded otherwise.",
  "Either way, glad we can actually weigh in now.",
  "My MP voted the other way, which is exactly why this platform matters.",
  "Read the bill text, not just the coverage.",
  "Hoping the Lords tidy up the weak parts.",
  "We'll see how it looks after committee.",
  ""
];

type SeedableBill = { id: number; short_title: string };

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function composePost(rng: () => number, billTitle: string, stance: "for" | "against" | "abstain") {
  const argument =
    stance === "for"
      ? pick(rng, FOR_ARGUMENTS)
      : stance === "against"
        ? pick(rng, AGAINST_ARGUMENTS)
        : pick(rng, ABSTAIN_ARGUMENTS);
  const opener = pick(rng, OPENERS).replace("{bill}", billTitle);
  const closer = pick(rng, CLOSERS);
  return `${opener} ${stance === "abstain" ? "" : stance === "for" ? "I'm backing it — " : "I can't support it — "}${argument}${closer ? ` ${closer}` : ""}`;
}

function sampleChoice(
  rng: () => number,
  billLean: number,
  userLean: number,
  abstainRate: number
): "for" | "against" | "abstain" {
  if (rng() < abstainRate) return "abstain";
  const pFor = Math.min(0.92, Math.max(0.08, 0.5 + billLean + userLean));
  return rng() < pFor ? "for" : "against";
}

export async function seedDemoCommunity(sql: Sql, options: { force?: boolean } = {}) {
  const [previous] = await sql`
    select id from data_import_runs
    where kind = 'demo-community-seed' and status = 'succeeded'
    order by id desc limit 1
  `;
  if (previous && !options.force) {
    return { skipped: true as const, reason: "demo community already seeded" };
  }

  const [run] = await sql`
    insert into data_import_runs (kind, status) values ('demo-community-seed', 'running')
    returning id
  `;
  const rng = mulberry32(RNG_SEED);

  // Bound seats only — these are the ones the map can display.
  const seats = await sql`
    select distinct c.id, c.name from constituencies c
    join svg_seat_bindings sb on sb.constituency_id = c.id
    order by c.id
  `;

  // Prefer division-linked bills (they power MP-alignment), then text-rich.
  const bills = (await sql`
    select b.id, b.short_title from bills b
    order by exists (select 1 from divisions d where d.bill_id = b.id) desc,
             exists (select 1 from bill_texts t where t.bill_id = b.id and t.text_content is not null) desc,
             b.last_updated desc nulls last
    limit ${BILL_COUNT}
  `) as unknown as SeedableBill[];

  if (seats.length === 0 || bills.length === 0) {
    await sql`
      update data_import_runs
      set status = 'failed', finished_at = now(),
          detail = ${sql.json({ reason: "no bound seats or no bills imported yet" })}
      where id = ${run.id}
    `;
    return { skipped: true as const, reason: "no bound seats or bills" };
  }

  // ---- 1. Demo population: persistent named users with per-seat leans ----
  const population: Array<{ userId: number; seatId: number; lean: number }> = [];
  for (const seat of seats) {
    const seatLean = (mulberry32(hashCode(seat.name as string) ^ RNG_SEED)() - 0.5) * 0.5;
    for (let i = 0; i < USERS_PER_SEAT; i += 1) {
      const name = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
      const session = await createSession(sql, name, seat.id as number, true);
      population.push({
        userId: session.userId,
        seatId: seat.id as number,
        lean: seatLean + (rng() - 0.5) * 0.3
      });
    }
  }

  // ---- 2. Ballots through the real credential pipeline ----
  const ballotsByBill: Record<number, number> = {};
  let ballots = 0;
  for (const bill of bills) {
    const billLean = (rng() - 0.5) * 0.55;
    const abstainRate = 0.05 + rng() * 0.09;
    ballotsByBill[bill.id] = 0;
    for (const seat of seats) {
      const seatTurnout = 0.45 + mulberry32(hashCode(`${seat.name}|${bill.id}`) ^ RNG_SEED)() * 0.4;
      const voters = population.filter((person) => person.seatId === (seat.id as number));
      for (const person of voters) {
        if (rng() > seatTurnout) continue;
        const issued = await issueCredential(sql, person.userId, bill.id, person.seatId);
        if ("error" in issued) continue;
        const choice = sampleChoice(rng, billLean, person.lean, abstainRate);
        await castBallot(sql, bill.id, issued.credential, choice);
        ballots += 1;
        ballotsByBill[bill.id] += 1;
        if (ballots % 2000 === 0) console.log(`[demo-community] ${ballots} ballots cast...`);
      }
    }
    await runCheckpoint(sql, bill.id);
    console.log(`[demo-community] bill ${bill.id} (${bill.short_title}): ${ballotsByBill[bill.id]} ballots`);
  }

  // ---- 3. Debate posts through the real moderation pipeline ----
  let posts = 0;
  const postIds: number[] = [];
  for (const bill of bills) {
    const postCount = 10 + Math.floor(rng() * 16);
    for (let i = 0; i < postCount; i += 1) {
      const person = population[Math.floor(rng() * population.length)];
      const stance = sampleChoice(rng, 0, person.lean, 0.12);
      const body = composePost(rng, bill.short_title, stance);
      const result = await moderateAndStorePost(sql, {
        billId: bill.id,
        userId: person.userId,
        body,
        stance
      });
      if (result.status === "posted") {
        posts += 1;
        postIds.push(result.postId);
      }
    }
  }

  const petitions = await sql`select id, action from petitions order by signature_count desc limit 8`;
  for (const petition of petitions.slice(0, 3)) {
    const postCount = 4 + Math.floor(rng() * 8);
    for (let i = 0; i < postCount; i += 1) {
      const person = population[Math.floor(rng() * population.length)];
      const stance = sampleChoice(rng, 0.1, person.lean, 0.1);
      const body = composePost(rng, petition.action as string, stance);
      const result = await moderateAndStorePost(sql, {
        petitionId: petition.id as number,
        userId: person.userId,
        body,
        stance
      });
      if (result.status === "posted") {
        posts += 1;
        postIds.push(result.postId);
      }
    }
  }

  // Spread post timestamps over the last three weeks so the debate doesn't
  // read as a single burst. Cosmetic only — moderation audit rows keep their
  // real times.
  for (const postId of postIds) {
    const minutesAgo = Math.floor(rng() * 21 * 24 * 60);
    await sql`
      update debate_posts set created_at = now() - make_interval(mins => ${minutesAgo})
      where id = ${postId}
    `;
  }

  // ---- 4. Petition votes through the real service ----
  let petitionVotes = 0;
  for (const [rank, petition] of petitions.entries()) {
    const participation = 0.45 / (1 + rank * 0.7);
    const petitionLean = (rng() - 0.5) * 0.7 + 0.15; // petitions skew supportive
    for (const person of population) {
      if (rng() > participation) continue;
      const choice = sampleChoice(rng, petitionLean, person.lean, 0.05);
      const result = await castPetitionVote(sql, person.userId, petition.id as number, choice);
      if (!("error" in result)) petitionVotes += 1;
    }
  }

  const detail = {
    users: population.length,
    seats: seats.length,
    ballots,
    ballotsByBill,
    debatePosts: posts,
    petitionVotes,
    usersPerSeat: USERS_PER_SEAT,
    rngSeed: RNG_SEED,
    note:
      "All fabricated participants are users.is_demo = true. Anonymous ballots are unlinkable by design; the per-bill ballot counts above are the record of which ballots are fake."
  };
  await sql`
    update data_import_runs
    set status = 'succeeded', finished_at = now(), detail = ${sql.json(detail)}
    where id = ${run.id}
  `;
  console.log("[demo-community] done:", JSON.stringify(detail));
  return { skipped: false as const, ...detail };
}
