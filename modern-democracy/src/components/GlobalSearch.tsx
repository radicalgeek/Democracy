import { useEffect, useRef, useState } from "react";
import { FileText, Landmark, ScrollText, Search } from "lucide-react";
import { fetchRepresentatives, type BackendBill, type RepListMember } from "../lib/api";
import type { PetitionLive } from "../data/types";

type GlobalSearchProps = {
  bills: BackendBill[];
  petitions: PetitionLive[];
  backendLive: boolean;
  onOpenBill: (billId: number) => void;
  onOpenMember: (memberId: number) => void;
  onOpenPetition: (petitionId: number) => void;
};

/** Topbar search across bills, MPs, and petitions, with a results dropdown. */
export function GlobalSearch({
  bills,
  petitions,
  backendLive,
  onOpenBill,
  onOpenMember,
  onOpenPetition
}: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<RepListMember[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim().toLowerCase();

  useEffect(() => {
    if (!backendLive || trimmed.length < 2) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchRepresentatives({ search: trimmed, take: 5 })
        .then((payload) => !cancelled && setMembers(payload.members))
        .catch(() => !cancelled && setMembers([]));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [backendLive, trimmed]);

  // Close when clicking anywhere outside the search box.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const billMatches =
    trimmed.length >= 2
      ? bills
          .filter((bill) =>
            `${bill.short_title} ${bill.long_title ?? ""}`.toLowerCase().includes(trimmed)
          )
          .slice(0, 5)
      : [];
  const petitionMatches =
    trimmed.length >= 2
      ? petitions
          .filter((petition) => petition.title.toLowerCase().includes(trimmed))
          .slice(0, 3)
      : [];

  const hasResults = billMatches.length + members.length + petitionMatches.length > 0;
  const showDropdown = open && trimmed.length >= 2;

  function pick(action: () => void) {
    action();
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="searchbox global-search" ref={rootRef}>
      <Search size={18} />
      <input
        aria-label="Search bills, MPs, and petitions"
        placeholder="Search bills, MPs, petitions"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter") {
            if (billMatches[0]) pick(() => onOpenBill(billMatches[0].id));
            else if (members[0]) pick(() => onOpenMember(members[0].id));
            else if (petitionMatches[0]) {
              const id = Number(petitionMatches[0].id);
              if (Number.isFinite(id)) pick(() => onOpenPetition(id));
            }
          }
        }}
      />
      {showDropdown && (
        <div className="search-results" role="listbox">
          {billMatches.length > 0 && (
            <div className="search-group">
              <span className="search-group-label">Bills</span>
              {billMatches.map((bill) => (
                <button key={`bill-${bill.id}`} onClick={() => pick(() => onOpenBill(bill.id))}>
                  <FileText size={14} />
                  <span>
                    <strong>{bill.short_title}</strong>
                    <em>
                      {bill.current_house ?? "—"} · {bill.current_stage ?? "—"}
                    </em>
                  </span>
                </button>
              ))}
            </div>
          )}
          {members.length > 0 && (
            <div className="search-group">
              <span className="search-group-label">MPs</span>
              {members.map((member) => (
                <button key={`mp-${member.id}`} onClick={() => pick(() => onOpenMember(member.id))}>
                  <Landmark size={14} />
                  <span>
                    <strong>{member.name}</strong>
                    <em>
                      {member.party ?? "Independent"} · {member.constituency ?? "—"}
                    </em>
                  </span>
                </button>
              ))}
            </div>
          )}
          {petitionMatches.length > 0 && (
            <div className="search-group">
              <span className="search-group-label">Petitions</span>
              {petitionMatches.map((petition) => {
                const id = Number(petition.id);
                return (
                  <button
                    key={`petition-${petition.id}`}
                    disabled={!Number.isFinite(id)}
                    onClick={() => Number.isFinite(id) && pick(() => onOpenPetition(id))}
                  >
                    <ScrollText size={14} />
                    <span>
                      <strong>{petition.title}</strong>
                      <em>{petition.signatures.toLocaleString()} signatures</em>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {!hasResults && (
            <p className="search-empty">
              No matches{backendLive ? "" : " — backend offline, MP search unavailable"}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
