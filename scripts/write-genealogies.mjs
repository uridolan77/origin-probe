/**
 * One-shot writer for admitted genealogies. Computes sourceSetHash at write time.
 * Run: node scripts/write-genealogies.mjs
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "data", "genealogies");

function hash(sources) {
  const lines = sources
    .map((s) => `${s.sourceId}\t${s.url}\t${s.publicationDate}`)
    .sort((a, b) => a.localeCompare(b));
  const digest = createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
  return `sha256:${digest.slice(0, 16)}`;
}

const accessedAt = "2026-08-29";
const reviewedAt = "2026-08-29";

const genealogies = [
  {
    genealogyId: "gen-culture-eats-strategy",
    slug: "culture-eats-strategy-for-breakfast",
    phrase: "Culture eats strategy for breakfast",
    aliases: [
      "culture eats strategy for lunch",
      "culture eats strategy",
      "culture trumps strategy",
    ],
    revision: 1,
    reviewedAt,
    status: "provisional",
    finding:
      "Popularized attribution to Peter Drucker is stronger than any coinage claim; the earliest verified breakfast wording located is a March 2000 Giga Information Group headline cited in a September 2000 trade journal.",
    searchScope:
      "English-language open web, Quote Investigator dossier, newspaper databases cited therein, and secondary management press. Did not inspect a physical March 2000 Giga Information Group original.",
    evidenceReviewed:
      "Quote Investigator (2017) with hardcopy-verified September 2000 PIMA citation; 2006 Associated Press coverage of Mark Fields; 2011 textbook Drucker attribution.",
    supersedesRevision: null,
    correctionHistory: [],
    assertions: [
      {
        assertionId: "a-culture-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        subject: "March 2000 Giga Information Group headline, as cited September 2000",
        publicStatement:
          "Earliest verified occurrence located: a September 2000 PIMA trade-journal article quotes a March 2000 Giga Information Group headline, “Culture Eats Strategy for Breakfast!”",
        evidenceIds: ["src-culture-pima-2000", "src-culture-qi-2017"],
        supportKind: "direct",
        caveat:
          "The March 2000 Giga periodical itself was not inspected in this review; the claim rests on the hardcopy-verified September 2000 citation reported by Quote Investigator.",
      },
      {
        assertionId: "a-culture-misattr",
        evidenceRole: "MISATTRIBUTED_TO",
        subject: "Peter Drucker",
        publicStatement:
          "Current evidence does not securely support coinage by Peter Drucker; his name appears attached to the saying years after the earliest located uses, including after his 2005 death.",
        evidenceIds: ["src-culture-qi-2017", "src-culture-textbook-2011"],
        supportKind: "supporting",
      },
      {
        assertionId: "a-culture-pop",
        evidenceRole: "POPULARIZED_BY",
        subject: "Corporate and management press, including Mark Fields / Ford coverage",
        publicStatement:
          "Popularized by management practice and press: by 2006 the slogan appears as a favorite of Ford executive Mark Fields, and later management writing often recycles a Drucker credit.",
        evidenceIds: ["src-culture-fields-2006", "src-culture-qi-2017"],
        supportKind: "supporting",
      },
      {
        assertionId: "a-culture-contested",
        evidenceRole: "CONTESTED_INCOMPLETE",
        subject: "Named coinage",
        publicStatement:
          "The record remains contested as to a named coiner; the March 2000 Giga headline author is not identified in the sources reviewed.",
        evidenceIds: ["src-culture-qi-2017"],
        supportKind: "incomplete",
      },
    ],
    sources: [
      {
        sourceId: "src-culture-pima-2000",
        title:
          "Recovered paper trading—ready for the Web? (citing March 2000 Giga headline)",
        author: "Bill Moore; Jerry Rose",
        publisher: "PIMA’s North American Papermaker",
        publicationDate: "2000-09",
        sourceType: "primary",
        url: "https://quoteinvestigator.com/2017/05/23/culture-eats/",
        accessedAt,
        supportsAssertionIds: ["a-culture-earliest"],
        shortExcerpt:
          "As stated in the March 2000 Giga Information Group headline “Culture Eats Strategy for Breakfast!”",
      },
      {
        sourceId: "src-culture-qi-2017",
        title: "Culture Eats Strategy for Breakfast",
        author: "Garson O’Toole",
        publisher: "Quote Investigator",
        publicationDate: "2017-05-23",
        sourceType: "secondary",
        url: "https://quoteinvestigator.com/2017/05/23/culture-eats/",
        accessedAt,
        supportsAssertionIds: [
          "a-culture-earliest",
          "a-culture-misattr",
          "a-culture-pop",
          "a-culture-contested",
        ],
        shortExcerpt:
          "Peter Drucker who died in 2005 was not mentioned in the earliest citations found by QI. His name was attached to the saying by 2011.",
      },
      {
        sourceId: "src-culture-fields-2006",
        title: "Ford takes close look at itself as job, factory cuts are set",
        author: "Dee-Ann Durbin (Associated Press)",
        publisher: "Arizona Daily Star (AP)",
        publicationDate: "2006-01-24",
        sourceType: "primary",
        url: "https://quoteinvestigator.com/2017/05/23/culture-eats/",
        accessedAt,
        supportsAssertionIds: ["a-culture-pop"],
        shortExcerpt:
          "One of Fields’ favorite slogans on the wall: “Culture eats strategy for breakfast.”",
      },
      {
        sourceId: "src-culture-textbook-2011",
        title: "Business Strategy: An Introduction (3rd ed.)",
        author: "David Campbell; David Edgar; George Stonehouse",
        publisher: "Palgrave Macmillan",
        publicationDate: "2011",
        sourceType: "secondary",
        url: "https://quoteinvestigator.com/2017/05/23/culture-eats/",
        accessedAt,
        supportsAssertionIds: ["a-culture-misattr"],
        shortExcerpt:
          "as the phrase often attributed to Peter Drucker claims: ‘Culture eats strategy for breakfast.’",
      },
    ],
  },
  {
    genealogyId: "gen-move-fast-break-things",
    slug: "move-fast-and-break-things",
    phrase: "Move fast and break things",
    aliases: ["move fast break things", "facebook move fast"],
    revision: 1,
    reviewedAt,
    status: "provisional",
    finding:
      "Direct coinage evidence supports Mark Zuckerberg / Facebook usage in the inspectable 2012 IPO letter; secondary reports place related public use earlier (2009), but that earlier transcript was not independently re-inspected here.",
    searchScope:
      "SEC EDGAR Facebook S-1 full text and secondary press summarizing earlier interview use. Did not obtain a contemporaneous 2009 Business Insider transcript beyond secondary quotation.",
    evidenceReviewed:
      "Facebook Form S-1 (2012-02-01) primary text; secondary reporting of Zuckerberg’s 2009 remarks.",
    supersedesRevision: null,
    correctionHistory: [],
    assertions: [
      {
        assertionId: "a-mfbt-coinage",
        evidenceRole: "CLAIMED_COINAGE",
        subject: "Mark Zuckerberg / Facebook internal saying",
        publicStatement:
          "Commonly credited to Mark Zuckerberg as a Facebook saying; the company presents it as its own motto in the 2012 IPO letter.",
        evidenceIds: ["src-mfbt-s1-2012"],
        supportKind: "direct",
      },
      {
        assertionId: "a-mfbt-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        subject: "Facebook Form S-1, 1 February 2012",
        publicStatement:
          "Earliest verified occurrence located in an inspectable primary text in this review: Zuckerberg’s letter in Facebook’s Form S-1 (1 February 2012).",
        evidenceIds: ["src-mfbt-s1-2012"],
        supportKind: "direct",
        caveat:
          "Secondary sources report earlier 2009 interview use; those earlier pages were not independently re-inspected as primary transcripts here.",
      },
      {
        assertionId: "a-mfbt-pop",
        evidenceRole: "POPULARIZED_BY",
        subject: "Facebook IPO letter (February 2012)",
        publicStatement:
          "Popularized by Zuckerberg’s “Hacker Way” letter in Facebook’s February 2012 Form S-1, which quotes the saying and explains it for investors.",
        evidenceIds: ["src-mfbt-s1-2012"],
        supportKind: "direct",
      },
    ],
    sources: [
      {
        sourceId: "src-mfbt-s1-2012",
        title: "Facebook, Inc. Form S-1 Registration Statement (Letter from Mark Zuckerberg)",
        author: "Mark Zuckerberg / Facebook, Inc.",
        publisher: "U.S. Securities and Exchange Commission",
        publicationDate: "2012-02-01",
        sourceType: "primary",
        url: "https://www.sec.gov/Archives/edgar/data/1326801/000119312512034517/d287954ds1.htm",
        accessedAt,
        supportsAssertionIds: ["a-mfbt-coinage", "a-mfbt-earliest", "a-mfbt-pop"],
        shortExcerpt:
          "We have a saying: “Move fast and break things.” The idea is that if you never break anything, you’re probably not moving fast enough.",
      },
    ],
  },
  {
    genealogyId: "gen-information-wants-to-be-free",
    slug: "information-wants-to-be-free",
    phrase: "Information wants to be free",
    aliases: [
      "information wants to be expensive",
      "info wants to be free",
    ],
    revision: 1,
    reviewedAt,
    status: "provisional",
    finding:
      "Direct coinage evidence supports Stewart Brand at the 1984 Hackers Conference; the free-only slogan is a contested truncation of a free-and-expensive paradox.",
    searchScope:
      "Quote Investigator dossier, contemporaneous Washington Post reporting, Whole Earth Review transcript citations, and Brand’s later Media Lab restatement. Did not inspect physical May 1985 Whole Earth Review hardcopy beyond QI’s verified excerpts.",
    evidenceReviewed:
      "QI (2018) citations to May 1985 Whole Earth Review transcript; 18 Nov 1984 Washington Post; Brand’s Media Lab (1987/1988).",
    supersedesRevision: null,
    correctionHistory: [],
    assertions: [
      {
        assertionId: "a-iwf-coinage",
        evidenceRole: "CLAIMED_COINAGE",
        subject: "Stewart Brand",
        publicStatement:
          "Commonly credited to Stewart Brand, who stated the free/expensive paradox at the November 1984 Hackers Conference.",
        evidenceIds: ["src-iwf-wer-1985", "src-iwf-wapo-1984"],
        supportKind: "direct",
      },
      {
        assertionId: "a-iwf-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        subject: "Hackers Conference, November 1984 / Washington Post 18 Nov 1984",
        publicStatement:
          "Earliest verified occurrence located: Brand’s November 1984 Hackers Conference remarks, reported in The Washington Post on 18 November 1984 and transcribed in Whole Earth Review (May 1985).",
        evidenceIds: ["src-iwf-wapo-1984", "src-iwf-wer-1985"],
        supportKind: "direct",
      },
      {
        assertionId: "a-iwf-contested",
        evidenceRole: "CONTESTED_INCOMPLETE",
        subject: "Free-only slogan vs paradox",
        publicStatement:
          "The record remains contested when the free half is quoted alone; Brand’s own framing pairs free with expensive, and later reuse often drops the costly half.",
        evidenceIds: ["src-iwf-qi-2018", "src-iwf-medialab-1987"],
        supportKind: "contested",
      },
      {
        assertionId: "a-iwf-pop",
        evidenceRole: "POPULARIZED_BY",
        subject: "Digital-culture reuse of the truncated slogan",
        publicStatement:
          "Popularized by repeated digital-culture citation of the free half, while Brand restated the full paradox in The Media Lab (1987).",
        evidenceIds: ["src-iwf-medialab-1987", "src-iwf-qi-2018"],
        supportKind: "supporting",
      },
    ],
    sources: [
      {
        sourceId: "src-iwf-wer-1985",
        title: "‘Keep designing’; Hackers’ Conference discussions (Nov 1984)",
        author: "Stewart Brand; Matt Herron",
        publisher: "Whole Earth Review",
        publicationDate: "1985-05",
        sourceType: "primary",
        url: "https://quoteinvestigator.com/2018/03/09/info/",
        accessedAt,
        supportsAssertionIds: ["a-iwf-coinage", "a-iwf-earliest"],
        shortExcerpt:
          "On the other hand, information wants to be free, because the cost of getting it out is getting lower and lower all the time.",
      },
      {
        sourceId: "src-iwf-wapo-1984",
        title: "Hacking Away at The Future",
        author: "Michael Schrage",
        publisher: "The Washington Post",
        publicationDate: "1984-11-18",
        sourceType: "primary",
        url: "https://quoteinvestigator.com/2018/03/09/info/",
        accessedAt,
        supportsAssertionIds: ["a-iwf-coinage", "a-iwf-earliest"],
        shortExcerpt:
          "“Information wants to be free,” said Stewart Brand… “But it also wants to be valuable,” a paradox he said is giving the fledging software industry such fits.",
      },
      {
        sourceId: "src-iwf-medialab-1987",
        title: "The Media Lab: Inventing the Future at MIT",
        author: "Stewart Brand",
        publisher: "Penguin / Viking",
        publicationDate: "1987",
        sourceType: "primary",
        url: "https://quoteinvestigator.com/2018/03/09/info/",
        accessedAt,
        supportsAssertionIds: ["a-iwf-contested", "a-iwf-pop"],
        shortExcerpt:
          "Information wants to be free because it has become so cheap to distribute, copy, and recombine—too cheap to meter. It wants to be expensive because it can be immeasurably valuable to the recipient.",
      },
      {
        sourceId: "src-iwf-qi-2018",
        title: "Information Wants To Be Expensive. Information Wants To Be Free",
        author: "Garson O’Toole",
        publisher: "Quote Investigator",
        publicationDate: "2018-03-09",
        sourceType: "secondary",
        url: "https://quoteinvestigator.com/2018/03/09/info/",
        accessedAt,
        supportsAssertionIds: ["a-iwf-contested", "a-iwf-pop"],
        shortExcerpt:
          "the phrase “Information wants to be free” by itself is an amputated distortion of his viewpoint.",
      },
    ],
  },
  {
    genealogyId: "gen-be-the-change",
    slug: "be-the-change-you-wish-to-see",
    phrase: "Be the change you wish to see in the world",
    aliases: [
      "be the change you want to see in the world",
      "be the change",
      "gandhi be the change",
    ],
    revision: 1,
    reviewedAt,
    status: "provisional",
    finding:
      "Prominent misattribution to Gandhi; attribution investigations point to a 1970s modern slogan trail and a 1913 Gandhi passage as a related antecedent, not the same wording. Earliest modern hardcopy was not independently re-inspected in this corpus.",
    searchScope:
      "Quote Investigator dossier and secondary reporting of the 1974/1987 print trail. Gandhi’s 1913 Indian Opinion passage reviewed via secondary quotation.",
    evidenceReviewed:
      "QI (2017) on Lorrance 1974 trail and Gandhi 1913 antecedent; secondary reporting of 1987 Gandhi attribution.",
    supersedesRevision: null,
    correctionHistory: [],
    assertions: [
      {
        assertionId: "a-btc-misattr",
        evidenceRole: "MISATTRIBUTED_TO",
        subject: "Mahatma Gandhi",
        publicStatement:
          "Current evidence does not securely support coinage by Gandhi for the concise modern slogan; the polished aphorism is not traced in his writings in that form.",
        evidenceIds: ["src-btc-qi-2017"],
        supportKind: "supporting",
      },
      {
        assertionId: "a-btc-antecedent",
        evidenceRole: "ANTECEDENT",
        subject: "Gandhi, Indian Opinion (1913)",
        publicStatement:
          "An earlier related formulation appears in Gandhi’s 1913 writing about changing ourselves so that tendencies in the world would also change — thematically related, not the same wording.",
        evidenceIds: ["src-btc-qi-2017"],
        supportKind: "supporting",
      },
      {
        assertionId: "a-btc-pop",
        evidenceRole: "POPULARIZED_BY",
        subject: "Late-1980s Gandhi attribution in U.S. press and later viral reuse",
        publicStatement:
          "Popularized by later attribution to Gandhi in U.S. press (from 1987 onward in the documented trail) and subsequent viral reuse of the Gandhi credit.",
        evidenceIds: ["src-btc-qi-2017"],
        supportKind: "supporting",
      },
      {
        assertionId: "a-btc-incomplete",
        evidenceRole: "CONTESTED_INCOMPLETE",
        subject: "Earliest modern slogan wording",
        publicStatement:
          "The record remains incomplete for an independently re-inspected primary of the earliest modern slogan wording; attribution investigations point to Arleen Lorrance (1974), pending hardcopy re-inspection in this corpus.",
        evidenceIds: ["src-btc-qi-2017"],
        supportKind: "incomplete",
      },
    ],
    sources: [
      {
        sourceId: "src-btc-qi-2017",
        title: "Be the Change You Wish To See in the World",
        author: "Garson O’Toole",
        publisher: "Quote Investigator",
        publicationDate: "2017-10-23",
        sourceType: "secondary",
        url: "https://quoteinvestigator.com/2017/10/23/be-change/",
        accessedAt,
        supportsAssertionIds: [
          "a-btc-misattr",
          "a-btc-antecedent",
          "a-btc-pop",
          "a-btc-incomplete",
        ],
        shortExcerpt:
          "Gandhi died in 1948, and the earliest close match known to QI appeared many years later in 1974 within a book chapter written by educator Arleen Lorrance.",
      },
    ],
  },
  {
    genealogyId: "gen-medium-is-the-message",
    slug: "the-medium-is-the-message",
    phrase: "The medium is the message",
    aliases: ["medium is the message", "mcluhan medium message"],
    revision: 1,
    reviewedAt,
    status: "provisional",
    finding:
      "Direct coinage evidence supports Marshall McLuhan; the phrase titles chapter one of Understanding Media (1964) and is treated as his formulation in the media-studies record reviewed.",
    searchScope:
      "Published Understanding Media text excerpts, McLuhan archive-site commentary, and standard reference summaries. Physical first edition not re-inspected beyond widely available chapter text.",
    evidenceReviewed:
      "Understanding Media chapter text (1964); McLuhan archive-site FAQ restating the 1964 passage; encyclopedia/reference summaries.",
    supersedesRevision: null,
    correctionHistory: [],
    assertions: [
      {
        assertionId: "a-mim-coinage",
        evidenceRole: "CLAIMED_COINAGE",
        subject: "Marshall McLuhan",
        publicStatement:
          "Commonly credited to Marshall McLuhan, who uses the phrase as the title and thesis of the opening chapter of Understanding Media (1964).",
        evidenceIds: ["src-mim-um-1964"],
        supportKind: "direct",
      },
      {
        assertionId: "a-mim-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        subject: "Understanding Media (1964)",
        publicStatement:
          "Earliest verified occurrence located in Marshall McLuhan, Understanding Media: The Extensions of Man (New York: McGraw-Hill, 1964), chapter “The Medium Is the Message.”",
        evidenceIds: ["src-mim-um-1964", "src-mim-archive-faq"],
        supportKind: "direct",
      },
      {
        assertionId: "a-mim-pop",
        evidenceRole: "POPULARIZED_BY",
        subject: "McLuhan’s media-theory reception and later title play (Massage)",
        publicStatement:
          "Popularized by the reception of Understanding Media and later cultural reuse, including the intentional 1967 title play The Medium Is the Massage.",
        evidenceIds: ["src-mim-archive-faq"],
        supportKind: "supporting",
      },
    ],
    sources: [
      {
        sourceId: "src-mim-um-1964",
        title: "Understanding Media: The Extensions of Man",
        author: "Marshall McLuhan",
        publisher: "McGraw-Hill",
        publicationDate: "1964",
        sourceType: "primary",
        url: "https://web.mit.edu/allanmc/www/mcluhan.mediummessage.pdf",
        accessedAt,
        supportsAssertionIds: ["a-mim-coinage", "a-mim-earliest"],
        shortExcerpt:
          "the medium is the message. This is merely to say that the personal and social consequences of any medium… result from the new scale that is introduced into our affairs",
      },
      {
        sourceId: "src-mim-archive-faq",
        title: "Commonly Asked Questions about McLuhan",
        author: "marshallmcluhan.org editors",
        publisher: "marshallmcluhan.org",
        publicationDate: "2010",
        sourceType: "secondary",
        url: "https://marshallmcluhan.org/common-questions/",
        accessedAt,
        supportsAssertionIds: ["a-mim-earliest", "a-mim-pop"],
        shortExcerpt:
          "The message of any medium or technology is the change of scale or pace or pattern that it introduces into human affairs. (Understanding Media, NY, 1964, p. 8)",
      },
    ],
  },
  {
    genealogyId: "gen-insanity-same-thing",
    slug: "insanity-doing-the-same-thing",
    phrase:
      "Insanity is doing the same thing over and over again and expecting different results",
    aliases: [
      "definition of insanity",
      "insanity same thing different results",
      "einstein insanity quote",
    ],
    revision: 1,
    reviewedAt,
    status: "provisional",
    finding:
      "Prominent misattribution to Einstein; popularization via 1980s recovery-community and fiction use is stronger than any Einstein coinage claim, while named authorship remains incomplete.",
    searchScope:
      "Quote Investigator dossier, Snopes summary, and cited 1981 newspaper / 1983 novel trail. Did not re-inspect Knoxville News-Sentinel microfilm beyond QI.",
    evidenceReviewed:
      "QI (2017) on early-1980s recovery-community trail and Rita Mae Brown 1983; Ultimate Quotable Einstein misattribution listing via QI.",
    supersedesRevision: null,
    correctionHistory: [],
    assertions: [
      {
        assertionId: "a-ins-misattr",
        evidenceRole: "MISATTRIBUTED_TO",
        subject: "Albert Einstein",
        publicStatement:
          "Current evidence does not securely support coinage by Albert Einstein; major Einstein quotation references list the line as misattributed.",
        evidenceIds: ["src-ins-qi-2017"],
        supportKind: "supporting",
      },
      {
        assertionId: "a-ins-pop",
        evidenceRole: "POPULARIZED_BY",
        subject: "Rita Mae Brown, Sudden Death (1983) and later Einstein myth",
        publicStatement:
          "Popularized in mainstream fiction by Rita Mae Brown’s 1983 novel Sudden Death, then later by unsupported Einstein attributions from around 1990.",
        evidenceIds: ["src-ins-qi-2017"],
        supportKind: "supporting",
      },
      {
        assertionId: "a-ins-contested",
        evidenceRole: "CONTESTED_INCOMPLETE",
        subject: "Named author and earliest hardcopy in this corpus",
        publicStatement:
          "The record remains incomplete as to a named original author, and the earliest newspaper trail (early 1980s recovery-community print) was not independently re-inspected as primary hardcopy in this corpus.",
        evidenceIds: ["src-ins-qi-2017"],
        supportKind: "incomplete",
      },
    ],
    sources: [
      {
        sourceId: "src-ins-qi-2017",
        title:
          "Insanity Is Doing the Same Thing Over and Over Again and Expecting Different Results",
        author: "Garson O’Toole",
        publisher: "Quote Investigator",
        publicationDate: "2017-03-23",
        sourceType: "secondary",
        url: "https://quoteinvestigator.com/2017/03/23/same/",
        accessedAt,
        supportsAssertionIds: ["a-ins-misattr", "a-ins-pop", "a-ins-contested"],
        shortExcerpt:
          "There is no substantive evidence that Einstein wrote or spoke the statement above. … based on current evidence the saying originated in one of the twelve-step communities.",
      },
    ],
  },
  {
    genealogyId: "gen-you-are-the-product",
    slug: "if-youre-not-paying-you-are-the-product",
    phrase:
      "If you’re not paying for the product, you are the product",
    aliases: [
      "you are the product",
      "if you are not paying for it you are the product",
      "youre not the customer youre the product",
    ],
    revision: 1,
    reviewedAt,
    status: "provisional",
    finding:
      "Popular 2010 MetaFilter wording is distinct from a 1973 video-art antecedent; popularization and origin are separate, and the TV critique is related rather than identical wording.",
    searchScope:
      "Quote Investigator dossier, MetaFilter 2010 comment trail via QI, and Richard Serra / Carlota Fay Schoolman 1973 video documentation.",
    evidenceReviewed:
      "QI (2017) on Television Delivers People (1973) and Andrew Lewis / blue_beetle MetaFilter (2010); MoMA/video documentation summaries.",
    supersedesRevision: null,
    correctionHistory: [],
    assertions: [
      {
        assertionId: "a-yap-antecedent",
        evidenceRole: "ANTECEDENT",
        subject: "Television Delivers People (1973)",
        publicStatement:
          "An earlier related formulation appears in Richard Serra and Carlota Fay Schoolman’s 1973 video Television Delivers People: “You are the product of t.v.” — related idea, not the later “if you’re not paying…” wording.",
        evidenceIds: ["src-yap-tdp-1973", "src-yap-qi-2017"],
        supportKind: "direct",
      },
      {
        assertionId: "a-yap-earliest-modern",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        subject: "MetaFilter comment by Andrew Lewis (2010)",
        publicStatement:
          "Earliest verified occurrence located for the modern “if you are not paying…” formulation: Andrew Lewis (blue_beetle) on MetaFilter in 2010.",
        evidenceIds: ["src-yap-metafilter-2010"],
        supportKind: "direct",
        caveat:
          "Earlier near-matches (for example 2001 Usenet “You’re not the customer, you’re the product”) exist without the payment clause; this page separates those roles.",
      },
      {
        assertionId: "a-yap-pop",
        evidenceRole: "POPULARIZED_BY",
        subject: "Social-media / surveillance-capitalism critique (2010s)",
        publicStatement:
          "Popularized by 2010s social-media criticism that recycled the MetaFilter line as a critique of free consumer platforms.",
        evidenceIds: ["src-yap-qi-2017"],
        supportKind: "supporting",
      },
      {
        assertionId: "a-yap-coinage",
        evidenceRole: "CLAIMED_COINAGE",
        subject: "Andrew Lewis (blue_beetle) for the payment-clause form",
        publicStatement:
          "Commonly credited to Andrew Lewis’s 2010 MetaFilter comment for the payment-clause form; that credit covers the modern wording, not the 1973 antecedent.",
        evidenceIds: ["src-yap-metafilter-2010"],
        supportKind: "direct",
      },
    ],
    sources: [
      {
        sourceId: "src-yap-tdp-1973",
        title: "Television Delivers People",
        author: "Richard Serra; Carlota Fay Schoolman",
        publisher: "Video artwork (broadcast/exhibited 1973)",
        publicationDate: "1973-03-30",
        sourceType: "primary",
        url: "https://www.moma.org/collection/works/119321",
        accessedAt,
        supportsAssertionIds: ["a-yap-antecedent"],
        shortExcerpt:
          "You are the product of t.v. You are delivered to the advertiser who is the customer.",
      },
      {
        sourceId: "src-yap-metafilter-2010",
        title: "MetaFilter comment on Digg / user-as-product",
        author: "Andrew Lewis (blue_beetle)",
        publisher: "MetaFilter",
        publicationDate: "2010-08-26",
        sourceType: "primary",
        url: "https://www.metafilter.com/95152/Userdriven-discontent",
        accessedAt,
        supportsAssertionIds: ["a-yap-earliest-modern", "a-yap-coinage"],
        shortExcerpt:
          "If you are not paying for it, you’re not the customer; you’re the product being sold.",
      },
      {
        sourceId: "src-yap-qi-2017",
        title: "You’re Not the Customer; You’re the Product",
        author: "Garson O’Toole",
        publisher: "Quote Investigator",
        publicationDate: "2017-07-16",
        sourceType: "secondary",
        url: "https://quoteinvestigator.com/2017/07/16/product/",
        accessedAt,
        supportsAssertionIds: ["a-yap-antecedent", "a-yap-pop"],
        shortExcerpt:
          "In conclusion, this saying evolved over time. Richard Serra and Carlota Fay Schoolman crafted an interesting precursor in 1973.",
      },
    ],
  },
];

mkdirSync(outDir, { recursive: true });
const keep = join(outDir, ".gitkeep");
if (existsSync(keep)) unlinkSync(keep);

for (const g of genealogies) {
  g.sourceSetHash = hash(g.sources);
  const path = join(outDir, `${g.slug}.json`);
  writeFileSync(path, JSON.stringify(g, null, 2) + "\n", "utf8");
  console.log("wrote", g.slug, g.sourceSetHash);
}

console.log("count", genealogies.length);
