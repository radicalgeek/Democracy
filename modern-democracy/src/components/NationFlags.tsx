/**
 * Small inline flags for the four nations of the UK plus the Union flag —
 * simplified geometry, official field colours. Used as a theming strip so the
 * design reads as the whole UK, not just the Union flag.
 */

type FlagProps = { title: string };

const FLAG_W = 30;
const FLAG_H = 18;

function UnionFlag({ title }: FlagProps) {
  return (
    <svg viewBox="0 0 60 36" width={FLAG_W} height={FLAG_H} role="img" className="nation-flag">
      <title>{title}</title>
      <rect width="60" height="36" fill="#012169" />
      <path d="M0,0 L60,36 M60,0 L0,36" stroke="#ffffff" strokeWidth="7" />
      <path d="M0,0 L60,36 M60,0 L0,36" stroke="#C8102E" strokeWidth="3" />
      <path d="M30,0 V36 M0,18 H60" stroke="#ffffff" strokeWidth="12" />
      <path d="M30,0 V36 M0,18 H60" stroke="#C8102E" strokeWidth="7" />
    </svg>
  );
}

function EnglandFlag({ title }: FlagProps) {
  return (
    <svg viewBox="0 0 60 36" width={FLAG_W} height={FLAG_H} role="img" className="nation-flag">
      <title>{title}</title>
      <rect width="60" height="36" fill="#ffffff" />
      <path d="M30,0 V36 M0,18 H60" stroke="#C8102E" strokeWidth="7" />
    </svg>
  );
}

function ScotlandFlag({ title }: FlagProps) {
  return (
    <svg viewBox="0 0 60 36" width={FLAG_W} height={FLAG_H} role="img" className="nation-flag">
      <title>{title}</title>
      <rect width="60" height="36" fill="#005EB8" />
      <path d="M0,0 L60,36 M60,0 L0,36" stroke="#ffffff" strokeWidth="7" />
    </svg>
  );
}

/**
 * Stylised Y Ddraig Goch, facing the hoist, drawn in a 100×50 box. Built from
 * a few simple shapes (body, head with open jaw, scalloped wing, legs,
 * arrow-tipped tail) so it stays readable from banner size down to a chip.
 */
export function WelshDragon({ transform }: { transform?: string }) {
  return (
    <g fill="#D30731" transform={transform}>
      <ellipse cx="55" cy="31" rx="20" ry="7.5" />
      {/* neck rising clear of the body to a head with open jaw and tongue */}
      <path d="M42,28 Q36,16 28,10.5 Q22,6.5 15,8 L5,4.5 L11,10.5 L3,12 L12,15 Q19,16.5 24,19.5 Q33,25 42,32 Z" />
      <path d="M25,8.5 L22,1 L30,7 Z" />
      {/* large bat wing raised high off the back */}
      <path d="M45,25 Q42,3 72,-2 Q63,8 66,11.5 Q57,13 60,17.5 Q51,18.5 54,25 Z" />
      {/* legs with simple claws */}
      <path d="M42,36.5 l-3,8.5 l6,-1.5 l-1,-7 Z" />
      <path d="M52,38 l-1,8.5 l6,-1.5 l-2,-7 Z" />
      <path d="M62,37.5 l1,8.5 l5.5,-2 l-3,-6.5 Z" />
      <path d="M70,34.5 l3.5,7.5 l5,-2.5 l-4.5,-6 Z" />
      {/* tail with arrow tip */}
      <path d="M74,28 Q88,26 93,18.5 L100,13.5 L94,13 L97,7 L88,11.5 Q84,19 74,23.5 Z" />
    </g>
  );
}

function WalesFlag({ title }: FlagProps) {
  return (
    <svg viewBox="0 0 60 36" width={FLAG_W} height={FLAG_H} role="img" className="nation-flag">
      <title>{title}</title>
      <rect width="60" height="18" fill="#ffffff" />
      <rect y="18" width="60" height="18" fill="#00B140" />
      <WelshDragon transform="translate(5,5.5) scale(0.5)" />
    </svg>
  );
}

function NorthernIrelandFlag({ title }: FlagProps) {
  return (
    <svg viewBox="0 0 60 36" width={FLAG_W} height={FLAG_H} role="img" className="nation-flag">
      <title>{title}</title>
      <rect width="60" height="36" fill="#ffffff" />
      <path d="M30,0 V36 M0,18 H60" stroke="#C8102E" strokeWidth="7" />
      {/* six-pointed star with the red hand */}
      <path d="M30,10 l2.3,4 h4.6 l-2.3,4 l2.3,4 h-4.6 l-2.3,4 l-2.3,-4 h-4.6 l2.3,-4 l-2.3,-4 h4.6 z" fill="#ffffff" stroke="#C8102E" strokeWidth="1" />
      <path d="M28.6,15.4 h2.8 v3.4 q0,1.6 -1.4,1.6 q-1.4,0 -1.4,-1.6 z" fill="#C8102E" />
    </svg>
  );
}

export function NationFlags() {
  return (
    <div className="nation-flags" aria-label="The nations of the United Kingdom">
      <UnionFlag title="United Kingdom" />
      <EnglandFlag title="England" />
      <ScotlandFlag title="Scotland" />
      <WalesFlag title="Wales" />
      <NorthernIrelandFlag title="Northern Ireland" />
    </div>
  );
}
