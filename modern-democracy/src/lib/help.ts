import { ReactNode } from "react";

export interface HelpTopic {
  id: string;
  title: string;
  shortDesc: string;
  content: ReactNode;
  relatedTopics?: string[];
  readTime?: number; // minutes
  videoUrl?: string;
}

export const HELP_TOPICS: Record<string, HelpTopic> = {
  compass: {
    id: "compass",
    title: "Political Compass",
    shortDesc: "How we measure political position",
    content: "Political positions exist on two dimensions: economic (left/right) and social authority (libertarian/authoritarian). The left wants redistribution; the right trusts markets. The bottom trusts individual freedom; the top trusts state authority. Bills and MPs have positions on this spectrum. Your votes show where you stand.",
    relatedTopics: ["bill-analysis", "mp-voting"],
    readTime: 3
  },

  "bill-process": {
    id: "bill-process",
    title: "How Bills Become Law",
    shortDesc: "The parliamentary stages your votes affect",
    content: "Every bill passes through five stages: (1) Second Reading — whole House debates the idea; (2) Committee — detailed line-by-line scrutiny and amendments; (3) Report — further amendments; (4) Third Reading — final debate; (5) Division — the formal recorded vote where MPs vote for/against. Your anonymous ballot counts alongside petitions, constituent feedback, and campaigns.",
    relatedTopics: ["divisions", "voting-mechanics"],
    readTime: 4
  },

  divisions: {
    id: "divisions",
    title: "Division Voting",
    shortDesc: "How MPs officially vote",
    content: "A division is the formal recorded vote at the end of parliamentary debate. Each MP's name and vote (Aye/No) is recorded in the official record. You can see how your MP voted and compare it to your own position on the same bill. Some MPs vote party line; others vote their conscience on specific issues.",
    relatedTopics: ["bill-process", "mp-voting"],
    readTime: 2
  },

  "anonymous-voting": {
    id: "anonymous-voting",
    title: "Why Your Ballots Are Anonymous",
    shortDesc: "Privacy-first voting design",
    content: "Your ballot is separated from your identity. You receive a credential to cast a ballot, then a receipt proving your ballot was included, but the ballot itself has no name on it. This protects you from coercion and prevents vote-selling. Parliament gets aggregate counts; you get proof of inclusion.",
    relatedTopics: ["verification-tiers", "vote-receipts"],
    readTime: 3
  },

  "vote-receipts": {
    id: "vote-receipts",
    title: "Vote Receipts",
    shortDesc: "Proving your ballot was counted",
    content: "After casting an anonymous ballot, you receive a unique receipt code. You can use this code to verify that your specific ballot was included in the final tally. The receipt doesn't reveal who you voted for—just that your vote was counted.",
    relatedTopics: ["anonymous-voting"],
    readTime: 2
  },

  constituencies: {
    id: "constituencies",
    title: "Constituencies",
    shortDesc: "What they are and why they matter",
    content: "The UK is divided into 650 constituencies, each electing one MP to Parliament. Your constituency is determined by your postcode. MPs represent their constituents' interests; your feedback as a constituent carries weight. Bills affect constituents differently—some change local policy directly.",
    relatedTopics: ["mp-voting", "representatives"],
    readTime: 2
  },

  "mp-voting": {
    id: "mp-voting",
    title: "Your MP's Voting Record",
    shortDesc: "Understanding how your representative votes",
    content: "Your MP's voting record shows how they voted on official divisions. Compare your positions: do you agree with how they vote? You can see if they vote party line or break from their party on certain issues. This helps you assess if your MP represents your views.",
    relatedTopics: ["divisions", "compass"],
    readTime: 3
  },

  petitions: {
    id: "petitions",
    title: "Parliamentary Petitions",
    shortDesc: "How petitions work and matter",
    content: "Parliament.uk petitions are public requests for action. If a petition reaches 100,000 signatures, Parliament must debate it. You can vote on petitions here separately from bills. Your petition votes are recorded (unlike bill ballots), but only aggregates are published.",
    relatedTopics: ["bill-process"],
    readTime: 2
  },

  moderation: {
    id: "moderation",
    title: "Debate & Moderation",
    shortDesc: "Why some posts are hidden or labeled",
    content: "We allow heated criticism of policy and institutions. Posts labeled 'heated-legitimate' are passionate but substantive. Hidden posts violate our standards: personal attacks, threats, doxxing, dehumanization, spam. Blocked posts are from users with repeated violations. You can criticize MPs' voting record harshly; you cannot attack them as people.",
    relatedTopics: [],
    readTime: 3
  },

  "verification-tiers": {
    id: "verification-tiers",
    title: "Verification Tiers",
    shortDesc: "What each tier unlocks",
    content: "Tier 0 (anon): Explore only, no voting. Tier 1 (registered): Provide email + postcode, vote on bills and petitions, see your constituency data. Tier 2 (verified): Full identity verification, unlock early features and advanced tools. Higher tiers prevent duplicate registration and enable more accurate local insights.",
    relatedTopics: ["anonymous-voting"],
    readTime: 2
  },

  representatives: {
    id: "representatives",
    title: "Representatives",
    shortDesc: "Finding and understanding MPs",
    content: "The House of Commons has 650 MPs. The House of Lords has ~750 peers who also vote on bills. Each MP represents their constituency. You can search MPs by name, party, or constituency to see their voting record, position on the compass, and party affiliation.",
    relatedTopics: ["mp-voting", "constituencies"],
    readTime: 2
  },

  news: {
    id: "news",
    title: "News Context",
    shortDesc: "Why news matters for bills",
    content: "Bills don't exist in isolation. News coverage, campaigns, and public debate shape how Parliament votes. Seeing news linked to bills helps you understand the broader context and what constituencies care about.",
    relatedTopics: ["bill-process"],
    readTime: 2
  }
};

export function getHelpTopic(id: string): HelpTopic | null {
  return HELP_TOPICS[id] ?? null;
}

export function getAllHelpTopicIds(): string[] {
  return Object.keys(HELP_TOPICS);
}
