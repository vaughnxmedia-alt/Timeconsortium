export type SpecialtyGroup = {
  id: string;
  label: string;
  summary: string;
};

export const specialtyGroups: SpecialtyGroup[] = [
  {
    id: "design-decor",
    label: "Design & Décor",
    summary:
      "Floral design, event styling and tablescapes, luxury rentals, linens, furniture and lounge rentals, tabletop and specialty dinnerware, draping, lighting, candle installations, backdrops and scenic fabrication, balloon installations, staging and runway production, tenting and flooring, and custom dance floors.",
  },
  {
    id: "fashion-beauty",
    label: "Fashion & Beauty",
    summary:
      "Bridal gowns, eveningwear, suits and tuxedos, bridesmaid and bridal party attire, alterations and custom tailoring, footwear, veils and accessories, jewelry, hair styling, makeup artistry, grooming, nail artistry, and fragrance.",
  },
  {
    id: "food-beverage",
    label: "Food & Beverage",
    summary:
      "Full-service catering, private chefs, grazing tables, hors d’oeuvres, wedding cakes, pastry and desserts, specialty dessert carts, beverage catering, bartending, mocktails, and coffee or espresso service.",
  },
  {
    id: "photo-film",
    label: "Photo, Film & Content",
    summary:
      "Wedding photography, event photography, videography, content creation, photo booths, portrait stations, and live streaming.",
  },
  {
    id: "entertainment",
    label: "Entertainment & Guest Experiences",
    summary:
      "DJs, live bands, string ensembles, solo musicians, emcees, dance performers, live event painters, live illustrators, live calligraphy or engraving, interactive installations, and cultural performers.",
  },
  {
    id: "stationery-gifts",
    label: "Stationery, Signage & Gifts",
    summary:
      "Custom invitations, day-of stationery, signage, seating charts, print and fabrication, favors, welcome gifts, gift packaging, and personalized keepsakes.",
  },
  {
    id: "ceremony-hospitality",
    label: "Ceremony, Venues & Hospitality",
    summary:
      "Officiants, ceremony musicians, venues, transportation and chauffeured service, valet, guest concierge, coat check, and event staffing.",
  },
  {
    id: "production",
    label: "Production & Event Services",
    summary:
      "Audiovisual production, sound, projection and LED displays, power and equipment rentals, event technology, registration and check-in, accessibility services, and security.",
  },
  {
    id: "other",
    label: "Other specialty",
    summary: "A service outside the listed specialties.",
  },
];

export type DirectoryProfile = {
  id: string;
  businessName: string;
  specialtyGroup: string;
  specialtyLabel: string;
  summary: string;
  portfolio: string;
  logoUrl: string;
  sample?: boolean;
};

const makersLogoPlaceholder = "/images/vendor-samples/makers-placeholder.svg";

export const previewProfiles: DirectoryProfile[] = [
  {
    id: "sample-brooks",
    businessName: "Brooks Tables",
    specialtyGroup: "design-decor",
    specialtyLabel: "Rentals & Linens",
    summary: "Ivory linens, tabletop pieces, and lounge seating prepared for the evening’s tablescapes.",
    portfolio: "https://example.com/brooks-tables",
    logoUrl: makersLogoPlaceholder,
    sample: true,
  },
  {
    id: "sample-cole",
    businessName: "Cole Atelier",
    specialtyGroup: "design-decor",
    specialtyLabel: "Floral Design",
    summary: "Candlelit floral installations shaped for the garden room and the runway after dark.",
    portfolio: "https://example.com/cole-atelier",
    logoUrl: makersLogoPlaceholder,
    sample: true,
  },
  {
    id: "sample-marlowe",
    businessName: "Marlowe House",
    specialtyGroup: "fashion-beauty",
    specialtyLabel: "Bridal Fashion",
    summary: "Bridal gowns and eveningwear fitted for the romantics and the guests who dress for the night.",
    portfolio: "https://example.com/marlowe-house",
    logoUrl: makersLogoPlaceholder,
    sample: true,
  },
  {
    id: "sample-sable",
    businessName: "Sable & Salt",
    specialtyGroup: "food-beverage",
    specialtyLabel: "Catering",
    summary: "Seasonal hors d’oeuvres and dessert carts that stay with the candlelit course of the evening.",
    portfolio: "https://example.com/sable-salt",
    logoUrl: makersLogoPlaceholder,
    sample: true,
  },
  {
    id: "sample-vale",
    businessName: "Vale & Vow",
    specialtyGroup: "photo-film",
    specialtyLabel: "Photography",
    summary: "Wedding and event photography that follows the arrival, the room, and the runway after dark.",
    portfolio: "https://example.com/vale-vow",
    logoUrl: makersLogoPlaceholder,
    sample: true,
  },
  {
    id: "sample-ember",
    businessName: "Ember String Quartet",
    specialtyGroup: "entertainment",
    specialtyLabel: "Live Music",
    summary: "A string ensemble for the welcome, the ceremony pause, and the first turn of the evening.",
    portfolio: "https://example.com/ember-string",
    logoUrl: makersLogoPlaceholder,
    sample: true,
  },
  {
    id: "sample-june",
    businessName: "June Letterpress",
    specialtyGroup: "stationery-gifts",
    specialtyLabel: "Stationery & Signage",
    summary: "Invitations, seating charts, and day-of stationery printed for the Beaumont evening.",
    portfolio: "https://example.com/june-letterpress",
    logoUrl: makersLogoPlaceholder,
    sample: true,
  },
  {
    id: "sample-carriage",
    businessName: "Carriage Lane Concierge",
    specialtyGroup: "ceremony-hospitality",
    specialtyLabel: "Guest Concierge",
    summary: "Guest arrival support, coat check, and chaperoned transitions through the gardens.",
    portfolio: "https://example.com/carriage-lane",
    logoUrl: makersLogoPlaceholder,
    sample: true,
  },
  {
    id: "sample-signal",
    businessName: "Signal House AV",
    specialtyGroup: "production",
    specialtyLabel: "Audiovisual Production",
    summary: "Sound, projection, and runway lighting for the staged moments of the night.",
    portfolio: "https://example.com/signal-house",
    logoUrl: makersLogoPlaceholder,
    sample: true,
  },
];

export function specialtyLabel(id: string) {
  return specialtyGroups.find((group) => group.id === id)?.label ?? id;
}

export function isSpecialtyGroup(id: string) {
  return specialtyGroups.some((group) => group.id === id);
}
