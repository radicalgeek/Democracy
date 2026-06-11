import { DatabaseZap } from "lucide-react";
import type { IntegrationStatus, ParliamentLiveBill } from "../data/types";

type IntegrationBannerProps = {
  statuses: IntegrationStatus[];
  liveBills: ParliamentLiveBill[];
};

export function IntegrationBanner({ statuses, liveBills }: IntegrationBannerProps) {
  return (
    <section className="integration-banner">
      <DatabaseZap size={19} />
      <div>
        <strong>Government data integrations</strong>
        <p>
          {statuses.map((status) => `${status.source}: ${status.status}`).join(" · ")}
          {liveBills.length > 0 ? ` · ${liveBills.length} live bills loaded` : " · sample bill active"}
        </p>
      </div>
    </section>
  );
}
