export type VoteChoice = "for" | "against" | "abstain";

export type CompassPoint = {
  x: number;
  y: number;
  label: string;
  confidence: number;
  rationale: string;
};

export type VoteBreakdown = {
  for: number;
  against: number;
  abstain: number;
  turnout: number;
};

export type ConstituencyMetric = {
  id: string;
  name: string;
  region: string;
  path: string;
  centroid: { x: number; y: number };
  registeredVoters: number;
  publicVote: VoteBreakdown;
  mpVote: VoteChoice;
  compass: CompassPoint;
  debateIntensity: number;
};

export type Representative = {
  id: string;
  name: string;
  party: string;
  constituencyId: string;
  alignment: number;
  recentVote: VoteChoice;
};

export type DebatePost = {
  id: string;
  author: string;
  publicBanCount: number;
  reputation: "new" | "steady" | "trusted" | "under-review";
  stance: VoteChoice;
  postedAt: string;
  body: string;
  moderation:
    | "clean"
    | "heated-legitimate"
    | "needs-review"
    | "personal-attack"
    | "trolling";
  compass: CompassPoint;
};

export type NewsItem = {
  id: string;
  source: string;
  title: string;
  type: "reporting" | "opinion" | "analysis" | "campaign";
  publishedAt: string;
  url: string;
  compass: CompassPoint;
  confidence: number;
  summary: string;
};

export type IntegritySnapshot = {
  id: string;
  publishedAt: string;
  merkleRoot: string;
  ballots: number;
  receiptVerified: boolean;
};

export type Bill = {
  id: string;
  parliamentId?: number;
  title: string;
  stage: string;
  house: string;
  status: string;
  summary: string;
  citations: Array<{ label: string; url: string }>;
  updatedAt: string;
  publicVote: VoteBreakdown;
  parliamentaryVote: VoteBreakdown;
  compass: CompassPoint;
  constituencies: ConstituencyMetric[];
  representatives: Representative[];
  debate: DebatePost[];
  news: NewsItem[];
  integrity: IntegritySnapshot;
};

export type PetitionState =
  | "open"
  | "awaiting-response"
  | "responded"
  | "awaiting-debate"
  | "debated"
  | "closed";

export type Petition = {
  id: string;
  petitionId?: number;
  title: string;
  background: string;
  creator: string;
  state: PetitionState;
  openedAt: string;
  signatures: number;
  responseThreshold: number;
  debateThreshold: number;
  governmentResponse?: string;
  publicVote: VoteBreakdown;
  compass: CompassPoint;
  debate: DebatePost[];
  integrity: IntegritySnapshot;
  sourceUrl: string;
};

export type PetitionLive = {
  id: string;
  title: string;
  state: string;
  signatures: number;
  openedAt: string;
  sourceUrl: string;
};

export type ParliamentLiveBill = {
  id: string;
  title: string;
  stage: string;
  house: string;
  status: string;
  updatedAt: string;
  sourceUrl: string;
};

export type IntegrationStatus = {
  source: string;
  status: "idle" | "loading" | "live" | "fallback" | "error";
  message: string;
  checkedAt?: string;
  records?: number;
};
