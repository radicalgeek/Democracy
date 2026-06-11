import type { IntegrationStatus, ParliamentLiveBill } from "../data/types";

type BillsApiItem = {
  billId: number;
  shortTitle?: string;
  currentHouse?: string;
  lastUpdate?: string;
  billType?: { name?: string };
  currentStage?: { description?: string };
};

type BillsApiResponse = {
  items?: BillsApiItem[];
};

const BILLS_API = "https://bills-api.parliament.uk/api/v1/Bills";
const MEMBERS_API = "https://members-api.parliament.uk/api/Members/Search";

export async function fetchLiveBills(limit = 8): Promise<{
  bills: ParliamentLiveBill[];
  status: IntegrationStatus;
}> {
  const startedAt = new Date().toISOString();

  try {
    const url = `${BILLS_API}?Take=${limit}&Skip=0`;
    const response = await fetch(url, {
      headers: { accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Bills API returned ${response.status}`);
    }

    const payload = (await response.json()) as BillsApiResponse;
    const items = payload.items ?? [];

    return {
      bills: items.map((item) => ({
        id: String(item.billId),
        title: item.shortTitle ?? `Bill ${item.billId}`,
        stage: item.currentStage?.description ?? "Stage unknown",
        house: item.currentHouse ?? "House unknown",
        status: item.billType?.name ?? "Bill",
        updatedAt: item.lastUpdate ?? startedAt,
        sourceUrl: `${BILLS_API}/${item.billId}`
      })),
      status: {
        source: "UK Parliament Bills API",
        status: "live",
        message: "Loaded current bill records from the official Bills API.",
        checkedAt: startedAt,
        records: items.length
      }
    };
  } catch (error) {
    return {
      bills: [],
      status: {
        source: "UK Parliament Bills API",
        status: "fallback",
        message:
          error instanceof Error
            ? `Using sample bills because live fetch failed: ${error.message}`
            : "Using sample bills because live fetch failed.",
        checkedAt: startedAt
      }
    };
  }
}

export async function checkMembersApi(): Promise<IntegrationStatus> {
  const startedAt = new Date().toISOString();

  try {
    const response = await fetch(`${MEMBERS_API}?Name=smith&skip=0&take=1`, {
      headers: { accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Members API returned ${response.status}`);
    }

    const payload = (await response.json()) as { items?: unknown[] };

    return {
      source: "UK Parliament Members API",
      status: "live",
      message: "Connected to the official Members API.",
      checkedAt: startedAt,
      records: payload.items?.length ?? 0
    };
  } catch (error) {
    return {
      source: "UK Parliament Members API",
      status: "fallback",
      message:
        error instanceof Error
          ? `Members API check failed: ${error.message}`
          : "Members API check failed.",
      checkedAt: startedAt
    };
  }
}

export function liveBillToDemoTitle(liveBills: ParliamentLiveBill[], fallback: string) {
  return liveBills[0]?.title ?? fallback;
}
