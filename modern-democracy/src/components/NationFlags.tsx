export const nationFlagAssets = [
  { id: "uk", name: "United Kingdom", src: "/flags/uk.svg" },
  { id: "england", name: "England", src: "/flags/england.svg" },
  { id: "scotland", name: "Scotland", src: "/flags/scotland.svg" },
  { id: "wales", name: "Wales", src: "/flags/wales.svg" },
  {
    id: "northern-ireland",
    name: "Northern Ireland",
    src: "/flags/northern-ireland.svg"
  }
] as const;

export function NationFlags() {
  return (
    <div className="nation-flags" aria-label="The nations of the United Kingdom">
      {nationFlagAssets.map((flag) => (
        <img
          key={flag.id}
          src={flag.src}
          alt={flag.name}
          className="nation-flag"
          loading="eager"
        />
      ))}
    </div>
  );
}
