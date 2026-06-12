import { BookOpenCheck, ChevronRight, Compass, Landmark, MessageSquare, Newspaper, Vote } from "lucide-react";
import type { BackendBill } from "../lib/api";

/**
 * One bill in the list, with the data that helps someone choose what to open:
 * where it is in the process, how much civic and parliamentary activity it
 * has, and which AI analyses are ready.
 */
export function BillListRow({
  bill,
  selected = false,
  onOpen
}: {
  bill: BackendBill;
  selected?: boolean;
  onOpen: () => void;
}) {
  const updated = bill.last_updated
    ? new Date(bill.last_updated).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;

  return (
    <article
      className={selected ? "bill-row rich clickable selected" : "bill-row rich clickable"}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
    >
      <div className="bill-row-copy">
        <strong>{bill.short_title}</strong>
        <span className="bill-row-meta">
          {bill.current_house ?? "—"} · {bill.current_stage ?? "stage unknown"}
          {updated && ` · updated ${updated}`}
        </span>
        <div className="bill-chip-row">
          {bill.ballots > 0 && (
            <span className="bill-chip strong">
              <Vote size={12} /> {bill.ballots.toLocaleString()} civic ballots
            </span>
          )}
          {bill.divisions > 0 && (
            <span className="bill-chip">
              <Landmark size={12} /> {bill.divisions} Commons division{bill.divisions === 1 ? "" : "s"}
            </span>
          )}
          {bill.hansard_debates > 0 && (
            <span className="bill-chip">
              <BookOpenCheck size={12} /> {bill.hansard_debates} Hansard debate{bill.hansard_debates === 1 ? "" : "s"}
            </span>
          )}
          {bill.debate_posts > 0 && (
            <span className="bill-chip">
              <MessageSquare size={12} /> {bill.debate_posts} post{bill.debate_posts === 1 ? "" : "s"}
            </span>
          )}
          {bill.news_items > 0 && (
            <span className="bill-chip">
              <Newspaper size={12} /> {bill.news_items} article{bill.news_items === 1 ? "" : "s"}
            </span>
          )}
          {(bill.has_summary || bill.has_debate_summary || bill.has_compass) && (
            <span className="bill-chip ai">
              <Compass size={12} />
              {[
                bill.has_summary ? "summary" : null,
                bill.has_debate_summary ? "debate" : null,
                bill.has_compass ? "compass" : null
              ]
                .filter(Boolean)
                .join(" · ")}{" "}
              AI
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={16} className="bill-row-chevron" />
    </article>
  );
}
