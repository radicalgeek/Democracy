import type { Sql } from "postgres";

/**
 * Government department drill-downs: a curated registry of the major spending
 * departments enriched live (and cached for a day) with the gov.uk content
 * API description, current ministers from the Members API government posts,
 * and the scrutinising select committee resolved via the Committees API.
 */

const CACHE_HOURS = 24;
const MEMBERS_API = "https://members-api.parliament.uk/api";
const COMMITTEES_API = "https://committees-api.parliament.uk/api";

export type DepartmentRegistryEntry = {
  slug: string;
  name: string;
  abbreviation: string;
  govukSlug: string;
  spend: string;
  spendNote: string;
  riskScore: number | null;
  riskLevel: string | null;
  riskNote: string | null;
  committeeSearch: string;
  /** Substrings matched against government post names to find its ministers. */
  postMatch: string[];
  links: Array<{ label: string; url: string }>;
};

const NAO = "https://www.nao.org.uk/search/?s=";
const PESA = "https://www.gov.uk/government/collections/public-expenditure-statistical-analyses-pesa";
const PAC = "https://committees.parliament.uk/committee/127/public-accounts-committee/";

export const DEPARTMENTS: DepartmentRegistryEntry[] = [
  {
    slug: "dwp",
    name: "Department for Work and Pensions",
    abbreviation: "DWP",
    govukSlug: "department-for-work-pensions",
    spend: "£300bn+",
    spendNote: "Pensions, universal credit and working-age benefits",
    riskScore: 78,
    riskLevel: "Very high",
    riskNote: "£9.3bn overpayments flagged in recent scrutiny",
    committeeSearch: "Work and Pensions Committee",
    postMatch: ["work and pensions"],
    links: [
      { label: "NAO reports on DWP", url: `${NAO}department+for+work+and+pensions` },
      { label: "Public Accounts Committee", url: PAC },
      { label: "HM Treasury PESA", url: PESA }
    ]
  },
  {
    slug: "dhsc",
    name: "Department of Health and Social Care",
    abbreviation: "DHSC",
    govukSlug: "department-of-health-and-social-care",
    spend: "£190bn+",
    spendNote: "NHS England, public health and social care",
    riskScore: 61,
    riskLevel: "High",
    riskNote: "Large spend, waiting-list pressure and procurement exposure",
    committeeSearch: "Health and Social Care Committee",
    postMatch: ["health and social care"],
    links: [
      { label: "NAO reports on health", url: `${NAO}health` },
      { label: "HM Treasury PESA", url: PESA }
    ]
  },
  {
    slug: "dfe",
    name: "Department for Education",
    abbreviation: "DfE",
    govukSlug: "department-for-education",
    spend: "£100bn+",
    spendNote: "Schools, colleges, skills and children's services",
    riskScore: 48,
    riskLevel: "Medium",
    riskNote: "School estate, SEND and capital delivery pressure",
    committeeSearch: "Education Committee",
    postMatch: ["education"],
    links: [
      { label: "NAO reports on education", url: `${NAO}education` },
      { label: "Major projects data", url: "https://www.gov.uk/government/collections/major-projects-data" }
    ]
  },
  {
    slug: "mod",
    name: "Ministry of Defence",
    abbreviation: "MOD",
    govukSlug: "ministry-of-defence",
    spend: "£50bn+",
    spendNote: "Armed forces, equipment programmes and operations",
    riskScore: 74,
    riskLevel: "Very high",
    riskNote: "Major project cancellation and nuclear transparency flags",
    committeeSearch: "Defence Committee",
    postMatch: ["defence"],
    links: [
      { label: "NAO reports on defence", url: `${NAO}defence` },
      { label: "Major projects data", url: "https://www.gov.uk/government/collections/major-projects-data" }
    ]
  },
  {
    slug: "home-office",
    name: "Home Office",
    abbreviation: "HO",
    govukSlug: "home-office",
    spend: "£20bn+",
    spendNote: "Policing, borders, asylum and security",
    riskScore: 66,
    riskLevel: "High",
    riskNote: "Asylum, migration and procurement pressure",
    committeeSearch: "Home Affairs Committee",
    postMatch: ["home department", "home office", "migration and citizenship"],
    links: [{ label: "NAO reports on the Home Office", url: `${NAO}home+office` }]
  },
  {
    slug: "hmt",
    name: "HM Treasury",
    abbreviation: "HMT",
    govukSlug: "hm-treasury",
    spend: "Sets all budgets",
    spendNote: "Fiscal policy, spending reviews and the public finances",
    riskScore: null,
    riskLevel: null,
    riskNote: null,
    committeeSearch: "Treasury Committee",
    postMatch: ["exchequer", "treasury"],
    links: [
      { label: "HM Treasury PESA", url: PESA },
      { label: "OBR forecasts", url: "https://obr.uk/forecasts-in-depth/" }
    ]
  },
  {
    slug: "moj",
    name: "Ministry of Justice",
    abbreviation: "MoJ",
    govukSlug: "ministry-of-justice",
    spend: "£10bn+",
    spendNote: "Courts, prisons, probation and legal aid",
    riskScore: null,
    riskLevel: null,
    riskNote: null,
    committeeSearch: "Justice Committee",
    postMatch: ["justice", "lord chancellor"],
    links: [{ label: "NAO reports on justice", url: `${NAO}justice` }]
  },
  {
    slug: "dft",
    name: "Department for Transport",
    abbreviation: "DfT",
    govukSlug: "department-for-transport",
    spend: "£44bn",
    spendNote: "Rail, roads, buses and active travel",
    riskScore: null,
    riskLevel: null,
    riskNote: null,
    committeeSearch: "Transport Committee",
    postMatch: ["transport"],
    links: [
      { label: "NAO reports on transport", url: `${NAO}transport` },
      { label: "Major projects data", url: "https://www.gov.uk/government/collections/major-projects-data" }
    ]
  }
];

export type DepartmentMinister = {
  post: string;
  name: string;
  party: string | null;
  memberId: number | null;
};

export type DepartmentProfile = DepartmentRegistryEntry & {
  description: string | null;
  govukUrl: string;
  ministers: DepartmentMinister[];
  committee: { name: string; url: string } | null;
  fetchedAt: string;
};

type GovernmentPost = {
  value?: {
    name?: string;
    postHolders?: Array<{
      member?: { value?: { id?: number; nameDisplayAs?: string; latestParty?: { name?: string } } };
    }>;
  };
};

async function fetchGovukDescription(govukSlug: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://www.gov.uk/api/content/government/organisations/${govukSlug}`,
      { headers: { accept: "application/json" } }
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { description?: string };
    return payload.description ?? null;
  } catch {
    return null;
  }
}

async function fetchGovernmentPosts(): Promise<GovernmentPost[]> {
  try {
    const response = await fetch(`${MEMBERS_API}/Posts/GovernmentPosts`, {
      headers: { accept: "application/json" }
    });
    if (!response.ok) return [];
    return (await response.json()) as GovernmentPost[];
  } catch {
    return [];
  }
}

function ministersFor(entry: DepartmentRegistryEntry, posts: GovernmentPost[]): DepartmentMinister[] {
  const ministers: DepartmentMinister[] = [];
  for (const post of posts) {
    const postName = post.value?.name ?? "";
    const lower = postName.toLowerCase();
    if (!entry.postMatch.some((term) => lower.includes(term))) continue;
    for (const holder of post.value?.postHolders ?? []) {
      const member = holder.member?.value;
      if (!member?.nameDisplayAs) continue;
      ministers.push({
        post: postName,
        name: member.nameDisplayAs,
        party: member.latestParty?.name ?? null,
        memberId: member.id ?? null
      });
    }
  }
  // Secretary of State (or Chancellor) first, then ministers of state, etc.
  return ministers.sort((a, b) => {
    const rank = (post: string) =>
      /secretary of state|chancellor of the exchequer|lord chancellor/i.test(post) ? 0 : /minister of state/i.test(post) ? 1 : 2;
    return rank(a.post) - rank(b.post);
  });
}

async function resolveCommittee(searchTerm: string): Promise<{ name: string; url: string } | null> {
  try {
    const response = await fetch(
      `${COMMITTEES_API}/Committees?SearchTerm=${encodeURIComponent(searchTerm)}&Take=1`,
      { headers: { accept: "application/json" } }
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { items?: Array<{ id?: number; name?: string }> };
    const committee = payload.items?.[0];
    if (!committee?.id || !committee.name) return null;
    const slug = committee.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return { name: committee.name, url: `https://committees.parliament.uk/committee/${committee.id}/${slug}/` };
  } catch {
    return null;
  }
}

export function listDepartments() {
  return DEPARTMENTS.map((entry) => ({
    slug: entry.slug,
    name: entry.name,
    abbreviation: entry.abbreviation,
    spend: entry.spend,
    spendNote: entry.spendNote,
    riskScore: entry.riskScore,
    riskLevel: entry.riskLevel
  }));
}

export async function departmentProfile(sql: Sql, slug: string): Promise<DepartmentProfile | null> {
  const entry = DEPARTMENTS.find((department) => department.slug === slug);
  if (!entry) return null;

  const [fresh] = await sql`
    select payload from department_cache
    where slug = ${slug} and fetched_at > now() - make_interval(hours => ${CACHE_HOURS})
  `;
  if (fresh) return fresh.payload as DepartmentProfile;

  const [description, posts, committee] = await Promise.all([
    fetchGovukDescription(entry.govukSlug),
    fetchGovernmentPosts(),
    resolveCommittee(entry.committeeSearch)
  ]);

  const profile: DepartmentProfile = {
    ...entry,
    description,
    govukUrl: `https://www.gov.uk/government/organisations/${entry.govukSlug}`,
    ministers: ministersFor(entry, posts),
    committee,
    fetchedAt: new Date().toISOString()
  };

  // Serve a stale profile rather than an empty one if everything live failed.
  if (!description && profile.ministers.length === 0 && !committee) {
    const [stale] = await sql`select payload from department_cache where slug = ${slug}`;
    if (stale) return stale.payload as DepartmentProfile;
  }

  await sql`
    insert into department_cache (slug, payload, fetched_at)
    values (${slug}, ${sql.json(profile as never)}, now())
    on conflict (slug) do update set payload = excluded.payload, fetched_at = now()
  `;
  return profile;
}
