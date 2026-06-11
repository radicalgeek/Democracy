import type { Bill, Petition } from "./types";

export const sampleBill: Bill = {
  id: "digital-civic-participation-bill",
  parliamentId: 3714,
  title: "Digital Civic Participation and Public Accountability Bill",
  stage: "Committee stage",
  house: "Commons",
  status: "Active",
  updatedAt: "2026-06-09T10:30:00Z",
  summary:
    "Creates a statutory framework for public consultation on major legislation, requiring departments to publish machine-readable summaries, constituency-level response data, and representative response statements before final votes.",
  citations: [
    {
      label: "UK Parliament Bills API",
      url: "https://bills-api.parliament.uk/index.html"
    },
    {
      label: "Members API",
      url: "https://members-api.parliament.uk/index.html"
    }
  ],
  publicVote: {
    for: 64218,
    against: 34880,
    abstain: 10892,
    turnout: 110004
  },
  parliamentaryVote: {
    for: 292,
    against: 238,
    abstain: 94,
    turnout: 624
  },
  compass: {
    x: -0.18,
    y: -0.62,
    label: "Libertarian centre-left",
    confidence: 0.78,
    rationale:
      "The bill shifts information power away from central institutions and toward citizens while expanding public accountability duties."
  },
  constituencies: [
    {
      id: "north-vale",
      name: "North Vale",
      region: "North West",
      path: "M98 62 L188 42 L248 95 L214 178 L112 165 Z",
      centroid: { x: 166, y: 112 },
      registeredVoters: 72340,
      publicVote: { for: 8124, against: 3920, abstain: 1104, turnout: 13148 },
      mpVote: "against",
      compass: {
        x: -0.36,
        y: -0.58,
        label: "Libertarian left",
        confidence: 0.73,
        rationale: "Local comments emphasize accountability and public control."
      },
      debateIntensity: 82
    },
    {
      id: "east-mercian",
      name: "East Mercian",
      region: "East Midlands",
      path: "M252 94 L356 72 L434 126 L396 220 L288 200 L214 178 Z",
      centroid: { x: 326, y: 151 },
      registeredVoters: 68420,
      publicVote: { for: 6020, against: 6188, abstain: 1704, turnout: 13912 },
      mpVote: "against",
      compass: {
        x: 0.28,
        y: -0.2,
        label: "Libertarian right",
        confidence: 0.65,
        rationale: "Supporters want transparency; critics worry about cost and state systems."
      },
      debateIntensity: 67
    },
    {
      id: "south-river",
      name: "South River",
      region: "London",
      path: "M116 172 L214 178 L288 200 L302 294 L206 350 L112 304 L82 226 Z",
      centroid: { x: 190, y: 254 },
      registeredVoters: 75891,
      publicVote: { for: 11290, against: 3032, abstain: 1842, turnout: 16164 },
      mpVote: "for",
      compass: {
        x: -0.48,
        y: -0.72,
        label: "Strong libertarian left",
        confidence: 0.8,
        rationale: "Debate focuses on popular oversight and open records."
      },
      debateIntensity: 91
    },
    {
      id: "west-downs",
      name: "West Downs",
      region: "South West",
      path: "M302 294 L396 220 L504 246 L526 348 L418 414 L206 350 Z",
      centroid: { x: 392, y: 318 },
      registeredVoters: 70102,
      publicVote: { for: 4892, against: 7430, abstain: 2011, turnout: 14333 },
      mpVote: "for",
      compass: {
        x: 0.42,
        y: 0.12,
        label: "Mild authoritarian right",
        confidence: 0.61,
        rationale: "Concerns focus on cost, data centralization, and identity checks."
      },
      debateIntensity: 58
    },
    {
      id: "central-borough",
      name: "Central Borough",
      region: "West Midlands",
      path: "M288 200 L396 220 L302 294 L206 350 Z",
      centroid: { x: 298, y: 268 },
      registeredVoters: 64280,
      publicVote: { for: 7092, against: 5014, abstain: 1288, turnout: 13394 },
      mpVote: "for",
      compass: {
        x: -0.08,
        y: -0.44,
        label: "Libertarian centre",
        confidence: 0.69,
        rationale: "Mixed economic view, strong demand for more public control."
      },
      debateIntensity: 74
    }
  ],
  representatives: [
    {
      id: "mp-1",
      name: "Aisha Patel",
      party: "Labour",
      constituencyId: "south-river",
      alignment: 82,
      recentVote: "for"
    },
    {
      id: "mp-2",
      name: "Thomas Greaves",
      party: "Conservative",
      constituencyId: "north-vale",
      alignment: 31,
      recentVote: "against"
    },
    {
      id: "mp-3",
      name: "Eleanor Hughes",
      party: "Liberal Democrat",
      constituencyId: "central-borough",
      alignment: 77,
      recentVote: "for"
    }
  ],
  debate: [
    {
      id: "post-1",
      author: "CivicNorth",
      publicBanCount: 0,
      reputation: "trusted",
      stance: "for",
      postedAt: "12 min ago",
      body:
        "I support this because it forces departments to publish the reasoning and the local response before MPs vote. That is not mob rule; it is basic accountability.",
      moderation: "clean",
      compass: {
        x: -0.24,
        y: -0.76,
        label: "Libertarian left",
        confidence: 0.82,
        rationale: "Argues for public control over institutional decision making."
      }
    },
    {
      id: "post-2",
      author: "MarketTownVoice",
      publicBanCount: 2,
      reputation: "steady",
      stance: "against",
      postedAt: "31 min ago",
      body:
        "The concern is legitimate: a national consultation platform can become another expensive state database. Supporters need to explain how identity is checked without tracking every political view.",
      moderation: "heated-legitimate",
      compass: {
        x: 0.36,
        y: -0.18,
        label: "Libertarian right",
        confidence: 0.71,
        rationale: "Defends privacy and market-cost concerns while avoiding personal attack."
      }
    },
    {
      id: "post-3",
      author: "PolicyForge",
      publicBanCount: 5,
      reputation: "under-review",
      stance: "against",
      postedAt: "47 min ago",
      body:
        "If the ministers pushing this cannot answer privacy questions, the bill should pause. Attack the policy, not the people voting for it.",
      moderation: "needs-review",
      compass: {
        x: 0.12,
        y: -0.32,
        label: "Libertarian centre",
        confidence: 0.64,
        rationale: "Raises privacy objections and meta-moderation concerns."
      }
    }
  ],
  news: [
    {
      id: "news-1",
      source: "Civic Ledger",
      title: "Consultation bill could expose the representative gap",
      type: "analysis",
      publishedAt: "2026-06-09",
      url: "https://example.com/civic-ledger",
      compass: {
        x: -0.22,
        y: -0.68,
        label: "Libertarian left",
        confidence: 0.74,
        rationale: "Frames the bill as power shifting toward citizens."
      },
      confidence: 0.74,
      summary:
        "Analysis argues the bill would make constituency divergence visible before final votes."
    },
    {
      id: "news-2",
      source: "The Market Standard",
      title: "Digital voting duties risk another costly Whitehall platform",
      type: "opinion",
      publishedAt: "2026-06-08",
      url: "https://example.com/market-standard",
      compass: {
        x: 0.58,
        y: 0.08,
        label: "Centre-right",
        confidence: 0.7,
        rationale: "Emphasizes public cost, procurement risk, and state expansion."
      },
      confidence: 0.7,
      summary:
        "Opinion piece argues accountability goals are valid but implementation could centralize too much data."
    },
    {
      id: "news-3",
      source: "Open Parliament Review",
      title: "What public consultation data can and cannot prove",
      type: "reporting",
      publishedAt: "2026-06-07",
      url: "https://example.com/open-parliament-review",
      compass: {
        x: -0.04,
        y: -0.22,
        label: "Libertarian centre",
        confidence: 0.62,
        rationale: "Mostly procedural with mild transparency framing."
      },
      confidence: 0.62,
      summary:
        "Explains turnout, representativeness, and privacy caveats around public consultation."
    }
  ],
  integrity: {
    id: "snapshot-2026-06-10-001",
    publishedAt: "2026-06-10T19:15:00Z",
    merkleRoot: "9f41c2d9b6e7a8f0c124e5ad7d391ed64b82c6a0f63e2d4b19aab8841c77d902",
    ballots: 110004,
    receiptVerified: true
  }
};

export const samplePetitions: Petition[] = [
  {
    id: "fund-rural-bus-routes",
    petitionId: 700412,
    title: "Restore funding for rural bus routes cut since 2020",
    background:
      "Hundreds of rural routes have been withdrawn, isolating people without cars from work, healthcare, and education. The petition asks the government to ring-fence funding to restore lost routes.",
    creator: "Verified petitioner",
    state: "awaiting-response",
    openedAt: "2026-04-22",
    signatures: 38420,
    responseThreshold: 10000,
    debateThreshold: 100000,
    publicVote: { for: 21408, against: 6233, abstain: 2811, turnout: 30452 },
    compass: {
      x: -0.34,
      y: -0.12,
      label: "Centre-left",
      confidence: 0.72,
      rationale:
        "Calls for public spending on shared infrastructure, framed around access and regional fairness rather than state control."
    },
    debate: [
      {
        id: "pet-post-1",
        author: "DalesCommuter",
        publicBanCount: 0,
        reputation: "trusted",
        stance: "for",
        postedAt: "26 min ago",
        body:
          "Our last evening bus was cut in 2022. People here turned down jobs because they cannot get home after 6pm. This is basic infrastructure, not a luxury.",
        moderation: "clean",
        compass: {
          x: -0.4,
          y: -0.2,
          label: "Centre-left",
          confidence: 0.78,
          rationale: "Argues for public provision based on access and fairness."
        }
      },
      {
        id: "pet-post-2",
        author: "FiscalRealist",
        publicBanCount: 0,
        reputation: "steady",
        stance: "against",
        postedAt: "44 min ago",
        body:
          "Sympathy for the goal, but a ring-fenced national fund is the wrong tool. Demand-responsive transport pilots cost less per passenger than restoring fixed routes nobody used.",
        moderation: "heated-legitimate",
        compass: {
          x: 0.44,
          y: -0.08,
          label: "Libertarian right",
          confidence: 0.69,
          rationale: "Prefers market-style efficiency tests over universal public funding."
        }
      }
    ],
    integrity: {
      id: "snapshot-2026-06-10-pet-001",
      publishedAt: "2026-06-10T19:15:00Z",
      merkleRoot: "4c8be1f02a9d7e6534f1cc28ab90d5e7613f48ba20cd9ae15327d6b09e84f1ca",
      ballots: 30452,
      receiptVerified: true
    },
    sourceUrl: "https://petition.parliament.uk/petitions/700412"
  },
  {
    id: "ban-smartphones-under-14",
    petitionId: 700973,
    title: "Ban the sale of smartphones to children under 14",
    background:
      "The petition argues social-media-capable phones are harming children's mental health and asks for an age-restricted sales regime similar to other age-rated products.",
    creator: "Verified petitioner",
    state: "open",
    openedAt: "2026-05-14",
    signatures: 121884,
    responseThreshold: 10000,
    debateThreshold: 100000,
    governmentResponse:
      "The government responded at 10,000 signatures: it has no current plans to restrict sales but is reviewing online safety guidance for under-16s. Having passed 100,000 signatures, the petition is awaiting a debate date.",
    publicVote: { for: 30122, against: 27876, abstain: 4410, turnout: 62408 },
    compass: {
      x: 0.08,
      y: 0.52,
      label: "Authoritarian centre",
      confidence: 0.7,
      rationale:
        "Asks the state to restrict a consumer market on child-protection grounds; cuts across left-right economics."
    },
    debate: [
      {
        id: "pet-post-3",
        author: "TeacherOfYear9",
        publicBanCount: 0,
        reputation: "trusted",
        stance: "for",
        postedAt: "18 min ago",
        body:
          "I see the attention and anxiety damage every day in my classroom. We age-restrict alcohol and gambling on harm evidence; the evidence here is now comparable.",
        moderation: "clean",
        compass: {
          x: -0.05,
          y: 0.46,
          label: "Authoritarian centre",
          confidence: 0.74,
          rationale: "Supports state restriction of a market to prevent harm to minors."
        }
      },
      {
        id: "pet-post-4",
        author: "ParentNotTheState",
        publicBanCount: 1,
        reputation: "steady",
        stance: "against",
        postedAt: "39 min ago",
        body:
          "This is a parenting decision, not a Whitehall one. A sales ban also fails technically: kids inherit hand-me-down phones. Mandate better defaults instead of banning hardware.",
        moderation: "heated-legitimate",
        compass: {
          x: 0.18,
          y: -0.58,
          label: "Libertarian right",
          confidence: 0.71,
          rationale: "Opposes state intervention in family and market decisions."
        }
      },
      {
        id: "pet-post-5",
        author: "SafetyByDesign",
        publicBanCount: 0,
        reputation: "new",
        stance: "abstain",
        postedAt: "1 hr ago",
        body:
          "The age line is arbitrary either way. The real question is device defaults and platform design. I want the debate in Parliament but I would not vote for this exact wording.",
        moderation: "clean",
        compass: {
          x: -0.02,
          y: 0.1,
          label: "Centre",
          confidence: 0.6,
          rationale: "Procedural stance focused on policy design rather than ideology."
        }
      }
    ],
    integrity: {
      id: "snapshot-2026-06-10-pet-002",
      publishedAt: "2026-06-10T19:15:00Z",
      merkleRoot: "b27d90c44e1f8a3652dd7e0b9c1845fa3e6072c81b5d4f9ea03c6d2718ab45ef",
      ballots: 62408,
      receiptVerified: true
    },
    sourceUrl: "https://petition.parliament.uk/petitions/700973"
  }
];
