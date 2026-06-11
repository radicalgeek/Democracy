import type { IntegrationStatus, PetitionLive } from "../data/types";

type PetitionsApiItem = {
  id: number;
  attributes?: {
    action?: string;
    state?: string;
    signature_count?: number;
    opened_at?: string;
    created_at?: string;
  };
  links?: { self?: string };
};

type PetitionsApiResponse = {
  data?: PetitionsApiItem[];
};

const PETITIONS_API = "https://petition.parliament.uk/petitions.json";

export async function fetchLivePetitions(limit = 8): Promise<{
  petitions: PetitionLive[];
  status: IntegrationStatus;
}> {
  const startedAt = new Date().toISOString();

  try {
    const response = await fetch(`${PETITIONS_API}?state=open`, {
      headers: { accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Petitions API returned ${response.status}`);
    }

    const payload = (await response.json()) as PetitionsApiResponse;
    const items = (payload.data ?? []).slice(0, limit);

    return {
      petitions: items.map((item) => ({
        id: String(item.id),
        title: item.attributes?.action ?? `Petition ${item.id}`,
        state: item.attributes?.state ?? "open",
        signatures: item.attributes?.signature_count ?? 0,
        openedAt: item.attributes?.opened_at ?? item.attributes?.created_at ?? startedAt,
        sourceUrl: `https://petition.parliament.uk/petitions/${item.id}`
      })),
      status: {
        source: "UK Parliament Petitions API",
        status: "live",
        message: "Loaded open petitions from the official Petitions API.",
        checkedAt: startedAt,
        records: items.length
      }
    };
  } catch (error) {
    return {
      petitions: [],
      status: {
        source: "UK Parliament Petitions API",
        status: "fallback",
        message:
          error instanceof Error
            ? `Using sample petitions because live fetch failed: ${error.message}`
            : "Using sample petitions because live fetch failed.",
        checkedAt: startedAt
      }
    };
  }
}
