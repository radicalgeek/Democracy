import { DatabaseZap } from "lucide-react";
import type { IntegrationStatus, ParliamentLiveBill } from "../data/types";

type IntegrationBannerProps = {
  statuses: IntegrationStatus[];
  liveBills: ParliamentLiveBill[];
};

export function IntegrationBanner({ statuses, liveBills }: IntegrationBannerProps) {
  const liveCount = statuses.filter((status) => status.status === "live").length;
  const fallbackCount = statuses.filter((status) => status.status === "fallback").length;
  const checking = statuses.some((status) => status.status === "loading" || status.status === "idle");
  const sourceSummary = checking
    ? "Checking public sources"
    : `${liveCount} public sources live${fallbackCount ? ` · ${fallbackCount} using backup data` : ""}`;

  return (
    <section className="integration-banner">
      <DatabaseZap size={19} />
      <div>
        <strong>Live civic data</strong>
        <p>
          {sourceSummary}
          {liveBills.length > 0
            ? ` · ${liveBills.length} current bills loaded`
            : " · showing sample bill while Parliament data catches up"}
        </p>
      </div>
    </section>
  );
}
