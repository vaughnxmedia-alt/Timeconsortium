/**
 * Edit this file to change event facts, images, tickets, the hotel partner,
 * and contact destinations. Page layouts read from here.
 *
 * Tickets
 * - phase "updates": buttons say “Join the List” and open the ticket-release
 *   signup form. RESEND_API_KEY, RESEND_FROM_WELCOME, and RESEND_FROM_OFFICE
 *   must be set; success shows only after Resend accepts the signup email.
 * - phase "sales" + checkoutUrl: buttons say “Get Tickets”.
 * - signupUrl is unused for the on-site form; keep checkoutUrl blank until sales.
 *
 * Hotel
 * - Set confirmed to true only when the name and other details are approved.
 * - bookingUrl is optional. “View Hotel Details” renders only when it is set.
 * - While confirmed is false, the development server shows placeholders.
 *   The public build hides the name, photo, rate, deadline, and button.
 *
 * The Makers (/vendor-hub) and sponsorship
 * - Applications and sponsor inquiries are saved by the server into Supabase
 *   when SUPABASE_URL and SUPABASE_SECRET_KEY are set.
 * - The first owner is created with scripts/create-staff-owner.mjs after the
 *   staff migration. There is no public signup. Teams opens a sign-in window.
 *   A new team member is emailed their password from the office address.
 *   SIGNING_SECRET must be at least 32 characters on the server.
 *   Square ticket totals stay at zero until SQUARE_ACCESS_TOKEN and
 *   SQUARE_LOCATION_ID are set.
 * - When Square is configured, accepting a paid vendor creates a Square
 *   checkout link. A fee cannot be confirmed until payment is recorded.
 * - Event-day instructions live in vendorProgram.eventDay.
 * - contacts.sponsorshipUrl is an optional https inbox for sponsor inquiries.
 *
 * About page
 * - featuredExperience is the event shown on /about. Change its name, copy,
 *   image, and link when Timeless Consortium features another occasion.
 *
 * Lead décor partner
 * - leadDecorPartner drives the homepage credit and The Makers feature.
 * - Set logo.src to a local asset when The Invite’s approved mark is ready.
 * - Swap photo.src/alt/width/height for an approved work photograph; leave
 *   photo.caption blank once the real photo replaces the concept image.
 */

export type ImageSlot = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type Concept = {
  name: string;
  image: string;
  alt: string;
  summary: string;
};

export const site = {
  name: "Timeless Consortium",
  partner: "JahKnowsPR Firm LLC",
  url: "https://www.timelessconsortium.com",
  shareImage: "/og/reverie-ember.jpg",
  shareImageAlt:
    "Reverie & Ember, a wedding and event experience in Beaumont, Texas, on Saturday, March 20, 2027.",
  logo: {
    src: "/brand/timeless-consortium-logo.png",
    alt: "Timeless Consortium",
    width: 600,
    height: 180,
  },
  wordmark: {
    src: "/brand/reverie-ember-wordmark.png",
    width: 565,
    height: 218,
  },
  monogram: {
    src: "/brand/reverie-ember-monogram.png",
    width: 256,
    height: 256,
  },
};

export const event = {
  name: "Reverie & Ember",
  path: "/reverie-and-ember",
  tagline: "An evening for the romantics and those who never pass up a reason to dress up.",
  kicker: "A wedding & event experience",
  dateLabel: "Saturday, March 20, 2027",
  dateISO: "2027-03-20",
  venue: "Beaumont Botanical Gardens",
  city: "Beaumont, Texas",
  locality: "Beaumont",
  region: "TX",
  placeLine: "Beaumont Botanical Gardens · Beaumont, Texas",
  /** Homepage identity line only. Midnight Central Time, New Year 2027, reveals the venue. */
  placeRevealAt: "2027-01-01T00:00:00-06:00",
  eveningTitle: "One evening in Beaumont.",
  eveningParagraphs: [
    "Find inspiration for your wedding or next celebration in candlelit tablescapes, sculptural florals, and the work of local event designers.",
    "Then take your seat for a runway of bridal fashion and eveningwear.",
  ],
  lede: "Reverie & Ember is a wedding and event experience at Beaumont Botanical Gardens in Beaumont, Texas, on Saturday, March 20, 2027. Timeless Consortium presents the evening in partnership with JahKnowsPR Firm LLC.",
  audience:
    "Couples, guests, and wedding and event planners share the room. Planners are invited as guests. Wedding and event design carries the same weight as bridal fashion and eveningwear, from the candlelit tablescapes to the runway after dark.",
  sequence: [
    {
      title: "Arrival",
      text: "The evening begins with guests arriving together, already dressed for it. Eveningwear is part of the night from the first step through the garden.",
    },
    {
      title: "The room",
      text: "Candlelit tablescapes, sculptural florals, and the work of local event designers set the celebration. This is wedding and event design, given a full look.",
    },
    {
      title: "The runway after dark",
      text: "Take a seat for a runway of bridal fashion and eveningwear. It is for the couple, the partygoer, and the planner watching how a look moves.",
    },
  ],
  closingHeading: "Get dressed for one evening in Beaumont.",
  recapPending: "Photographs and notes from the evening will be gathered here.",
  recap: {
    ready: false,
    intro: "",
    images: [] as ImageSlot[],
  },
  /**
   * Old Hollywood, Silk Wave, and The Ember Finale stay off the page until
   * each one has an approved image. Add image, alt, and summary together.
   */
  concepts: [
    {
      name: "Old Hollywood",
      image: "",
      alt: "",
      summary: "",
    },
    {
      name: "Silk Wave",
      image: "",
      alt: "",
      summary: "",
    },
    {
      name: "The Ember Finale",
      image: "",
      alt: "",
      summary: "",
    },
  ] as Concept[],
};

/** Guest itinerary, shown on the Reverie & Ember page. /the-evening redirects there. */
export const eveningPage = {
  path: "/reverie-and-ember#itinerary",
  navLabel: "The Evening",
  title: "The Evening",
  intro:
    "A clear look at how Reverie & Ember unfolds — from the first arrival through the garden to the runway after dark.",
  note: "Times are approximate and will be confirmed for ticket holders as the evening approaches.",
  homeTeaserTitle: "Follow the night.",
  homeTeaser:
    "Arrival, the candlelit room, and the runway after dark — see how the evening moves.",
  homeTeaserLink: "View the itinerary",
  itinerary: [
    {
      time: "6:00 PM",
      title: "Arrival",
      text: "Guests gather at Beaumont Botanical Gardens, already dressed for the night. Candlelight and eveningwear set the tone from the first step in.",
    },
    {
      time: "6:30 PM",
      title: "Welcome & the room",
      text: "Move into the celebration: candlelit tablescapes, sculptural florals, and the work of local designers shaping the space for the evening ahead.",
    },
    {
      time: "7:15 PM",
      title: "Tables & conversation",
      text: "Settle into the room. Couples, guests, and planners share the table as the décor and hospitality of Reverie & Ember come into full view.",
    },
    {
      time: "8:00 PM",
      title: "The runway after dark",
      text: "Take a seat for bridal fashion and eveningwear. A look at how the clothes move — for the couple, the partygoer, and the planner watching closely.",
    },
    {
      time: "9:00 PM",
      title: "After the runway",
      text: "The night continues in the room — lingering conversation, last looks at the setting, and time to stay a little longer before the evening closes.",
    },
  ],
};

export const images: {
  header: ImageSlot;
  arrival: ImageSlot;
  evening: ImageSlot;
  tablescape: ImageSlot;
  runway: ImageSlot;
} = {
  header: {
    src: "/images/header.jpg",
    alt: "A candlelit reception table at blue hour, set with linen, glassware, and burgundy florals beside garden windows.",
    width: 576,
    height: 1024,
  },
  arrival: {
    src: "/images/arrival.jpg",
    alt: "Guests in eveningwear arriving together at dusk between oxblood curtains, with candlelight along a garden path.",
    width: 411,
    height: 548,
  },
  evening: {
    src: "/images/evening-bridal.jpg",
    alt: "A bride in a flowing white gown and sheer veil holds a paper parasol on a hilltop deck at sunset.",
    width: 819,
    height: 1024,
  },
  tablescape: {
    src: "/images/tablescape.jpg",
    alt: "Guests at a candlelit table beneath a tall sculptural arrangement of white and burgundy florals, with a bride in view beyond the room.",
    width: 396,
    height: 304,
  },
  runway: {
    src: "",
    alt: "",
    width: 0,
    height: 0,
  },
};

export const aboutPage = {
  path: "/about",
  label: "Discover",
  title: "About | Timeless Consortium",
  description:
    "About Timeless Consortium, where fashion, hospitality, and event design share the room. The featured experience is Reverie & Ember in Beaumont, Texas.",
  headline: "The room is part of the occasion.",
  paragraphs: [
    "There’s a moment when you walk into a room and slow down. You notice the light across the table, the way everyone dressed for the evening, the conversations already taking shape. You’re glad you made plans.",
    "Timeless Consortium brings together the people who know how to create that feeling. We work with designers, artisans, and creative partners to shape gatherings where fashion, hospitality, and event design share the room. Each occasion has its own character, from the first welcome to the moment you realize you’d like to stay a little longer.",
  ],
  opening: {
    src: "/images/about-opening.jpg",
    alt: "Candlelit roses and pillar candles in glass beside an oxblood curtain, with a reception room glowing through the doorway.",
    width: 819,
    height: 1024,
    position: "center 62%",
  },
};

export const featuredExperience = {
  eyebrow: "The featured experience",
  name: "Reverie & Ember",
  tagline: "For the lovers and the elegant partygoers.",
  summary:
    "An evening of wedding and event design, candlelit tablescapes, and a runway of bridal fashion and eveningwear at Beaumont Botanical Gardens.",
  meta: "Saturday, March 20, 2027 · Beaumont, Texas",
  button: "Explore Reverie & Ember",
  href: "/reverie-and-ember",
  image: {
    src: "/images/featured-table.jpg",
    alt: "A candlelit place setting with gold flatware, linen, and a burgundy orchid, beside a bowl of burgundy and white flowers.",
    width: 1024,
    height: 819,
    position: "center 55%",
  },
};

const namibia = (file: string) => `/images/namibia/${file}`;

export const namibiaEditorial = {
  path: "/discover/namibia-editorial",
  title: "The Namibia Editorial | Timeless Consortium",
  description:
    "A Timeless Consortium editorial photographed in Namibia: a parasol lifted into the sunset, a cello played in the open air, and the small details of the evening.",
  feature: {
    eyebrow: "A Timeless Consortium editorial",
    name: "The Namibia Editorial",
    tagline: "An evening in the last light.",
    summary:
      "A parasol lifted into the sunset, a cello played in the open air, and the small details that made the evening worth remembering.",
    button: "Explore the Editorial",
  },
  backLabel: "Back to Discover",
  heading: "The Namibia Editorial",
  location: "Photographed in Namibia",
  opening:
    "The sun was still on the horizon when the musicians began to play. She lifted her parasol, and the fabric caught the last of the light. In the photographs that followed, the evening comes into focus one detail at a time: the sweep of a veil, a hand on the cello, and the moment before a gift is opened.",
  hero: {
    src: namibia("parasol-sunset-wide.jpg"),
    alt: "A model in a white organza robe with rosette collar smiles beneath a raised paper parasol at sunset, sheer veil sweeping across the frame as a cellist plays behind her.",
    width: 1024,
    height: 681,
    position: "22% 30%",
  },
  spreads: [
    [
      {
        src: namibia("full-length-veil.jpg"),
        alt: "Full-length portrait of the model on a wooden deck at sunset, parasol raised and a long sheer veil billowing around her white gown.",
        width: 819,
        height: 1024,
        caption: "The full silhouette, veil caught in the evening wind.",
      },
      {
        src: namibia("under-the-parasol.jpg"),
        alt: "Close-up of the model beneath her paper parasol, eyes lowered, rosettes at her collar and a veil framing the sunset behind her.",
        width: 681,
        height: 1024,
        caption: "Beneath the parasol.",
      },
    ],
    [
      {
        src: namibia("cellist.jpg"),
        alt: "A cellist in a grey waistcoat plays with his eyes closed on an open-air deck at dusk, a flutist beside him.",
        width: 681,
        height: 1024,
        caption: "A hand on the cello as the sky turns.",
      },
      {
        src: namibia("flutist.jpg"),
        alt: "A flutist in a dark suit plays before a music stand at blue hour, city lights glowing on the horizon behind him.",
        width: 681,
        height: 1024,
        caption: "The flute, with the lights coming on below.",
      },
    ],
    [
      {
        src: namibia("opening-the-box.jpg"),
        alt: "The model, seated on a bed with a teal throw, smiles as she lifts the lid of a white presentation box.",
        width: 819,
        height: 1024,
        caption: "The moment before the gift is opened.",
      },
      {
        src: namibia("the-gift.jpg"),
        alt: "The model laughs with delight as she holds a small black velvet box, sheer sleeves gathered at her wrists.",
        width: 819,
        height: 1024,
        caption: "Opened.",
      },
    ],
    [
      {
        src: namibia("hands-on-the-box.jpg"),
        alt: "Detail of manicured hands reaching into a white presentation box lined with black velvet ring boxes.",
        width: 681,
        height: 1024,
        caption: "Detail: velvet boxes inside the presentation case.",
      },
      {
        src: namibia("timeless-accord.jpg"),
        alt: "Four Timeless Accord fragrance bottles with gold caps lined up on a white marble ledge beside white roses and eucalyptus.",
        width: 1024,
        height: 681,
        caption: "Timeless Accord, set beside white roses.",
      },
    ],
  ],
};

export const pages = {
  home: {
    title: "Reverie & Ember | Timeless Consortium",
    description:
      "Timeless Consortium presents Reverie & Ember, a wedding and event experience in Beaumont, Texas, on Saturday, March 20, 2027.",
  },
  event: {
    title: "Reverie & Ember | Wedding and event experience in Beaumont, Texas",
    description:
      "Reverie & Ember is a wedding and event experience in Beaumont, Texas, at Beaumont Botanical Gardens on Saturday, March 20, 2027.",
  },
  evening: {
    title: "The Evening | Reverie & Ember itinerary",
    description:
      "The guest itinerary for Reverie & Ember at Beaumont Botanical Gardens — arrival, the candlelit room, and the runway after dark.",
  },
  vendor: {
    title: "The Makers of Reverie & Ember | Timeless Consortium",
    description:
      "Meet the businesses and creatives behind the florals, fashion, food, and design of Reverie & Ember.",
  },
  vendorRequest: {
    title: "Apply to Exhibit | Timeless Consortium",
    description:
      "Apply to exhibit at Reverie & Ember. Tell Timeless Consortium about your business, your work, and how you’d like to take part.",
  },
};

export const tickets = {
  /** "updates" before sales open. "sales" once checkout is ready. */
  phase: "updates" as "updates" | "sales",
  /** Midnight Central Time. The homepage countdown ends here. Checkout stays closed until phase is "sales" and checkoutUrl is set. */
  launchAt: "2027-01-01T00:00:00-06:00",
  signupUrl: "",
  checkoutUrl: "",
};

export const ticketSignup = {
  buttonLabel: "Join the List",
  heading: "Be the first to hear when tickets go on sale.",
  supporting:
    "Sign up for the Reverie & Ember ticket release and a first look at what’s planned for the evening.",
  emailLabel: "Email address",
  submitLabel: "Join the List",
  success: "You’re on the list. We’ll email you when tickets go on sale.",
  unconfigured:
    "Ticket-release signup is not connected yet. Set RESEND_API_KEY and RESEND_FROM_WELCOME to send the announcement list.",
  invalidEmail: "Enter a valid email address.",
  failure: "We could not complete your signup. Please try again.",
};

export const hotel = {
  confirmed: false,
  name: "",
  photo: "",
  photoAlt: "",
  photoWidth: 0,
  photoHeight: 0,
  bookingUrl: "",
  groupRate: "",
  reservationDeadline: "",
  note: "",
};

export const hotelPreview = {
  name: "[Hotel Name]",
  photo: "/images/hotel-room.jpg",
  photoAlt:
    "A hotel room at dusk with white linens, a burgundy throw, and a window onto trees. Not a confirmed hotel partner.",
  photoWidth: 1024,
  photoHeight: 372,
  groupRate: "[Group rate]",
  reservationDeadline: "[Reservation deadline]",
};

export const leadDecorPartner = {
  eyebrow: "Lead Décor Partner",
  name: "The Invite",
  credit: "The setting, by The Invite",
  summary:
    "The Invite brings the décor of Reverie & Ember to life through event rentals, styling, and installations that set the tone from the moment guests arrive.",
  role: "Lead Décor Partner",
  specialty: "Event Décor, Rentals & Styling",
  buttonLabel: "Visit The Invite",
  url: "https://theinvitetx.com/",
  logo: {
    /** Local path to the approved logo. Leave blank to show the name in serif type. */
    src: "/brand/the-invite-logo.png",
    alt: "The Invite — Event Decor, Props, Design",
    width: 1024,
    height: 1024,
  },
  photo: {
    src: "/images/the-invite-tablescape.jpg",
    alt: "A candlelit place setting with gold flatware, ivory napkins topped with burgundy orchids, and a gold vase of burgundy and white flowers beside a floral arch.",
    width: 1024,
    height: 819,
    caption: "",
  },
};

export const vendor = {
  navLabel: "The Makers",
  title: "The Makers",
  intro: "Meet the businesses and creatives behind the florals, fashion, food, and design of the evening.",
  deadline: "February 16, 2027",
  paragraphs: [
    "Reverie & Ember brings wedding and event design, eveningwear, candlelit tablescapes, and the runway after dark into one evening at Beaumont Botanical Gardens. If your work belongs in that room, this is where to say so.",
    "Wedding and event planners who want to attend are invited as guests. Ticket updates stay with the event. Sponsorship inquiries go to Partner With Us.",
  ],
  requestPath: "/vendor-hub/request",
  requestLabel: "Apply to Exhibit",
  formTitle: "Apply to Exhibit",
  formIntro:
    "Show us what you’d bring to Reverie & Ember. Tell us about your business, share your work, and give us a sense of how you’d like to participate. Applications are due by February 16, 2027.",
  confirmation:
    "We received your application. Our team will review your submission and follow up by email with a decision and any next steps.",
  selectedTitle: "Meet the Makers",
  previewTitle: "Preview the Vendor Directory",
  previewNote: "Sample profiles for layout preview.",
  selectedEmpty: "The maker lineup will be announced here",
  placeholderEyebrow: "The Makers",
  placeholderLine1: "A place for",
  placeholderLine2: "your brand.",
  sponsorLink: "Sponsorship inquiries",
};

export const vendorProgram = {
  agreement:
    "I agree to participate in Reverie & Ember as described in the participation details, including the deadline and any fee listed for this acceptance.",
  eventDay: {
    /** Set released to true only when the instructions below are ready to show. */
    released: false,
    loadIn: "",
    parking: "",
    setup: "",
    contact: "",
  },
};

export const sponsorPage = {
  path: "/partner-with-us",
  title: "Partner With Us | Timeless Consortium",
  description:
    "Request sponsorship information for Reverie & Ember. Sponsorship inquiries are separate from vendor participation.",
  heading: "Partner With Us",
  intro:
    "Sponsorship is separate from vendor participation. Tell us whether you are interested in financial support, an in-kind contribution, or a conversation about options.",
  submitLabel: "Request Sponsorship Information",
  confirmation:
    "We received your sponsorship inquiry. Our team will review it and follow up by email.",
};

export const contacts = {
  /** https:// or mailto: — shown only after this is set. */
  sponsorshipUrl: "",
};

export const publicCopy = {
  ticketsPending:
    "Ticket-release notifications for Reverie & Ember will open here when signup is connected.",
  hotelPending:
    "A hotel partner for guests of the evening will be confirmed here, including the group rate and the reservation deadline.",
};
