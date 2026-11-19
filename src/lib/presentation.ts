import {
  contacts,
  hotel,
  hotelPreview,
  publicCopy,
  ticketSignup,
  tickets,
} from "../config/site";

export const isPreview = import.meta.env.DEV;

function clean(value: string) {
  return value.trim();
}

function isHttp(value: string) {
  return /^https?:\/\//i.test(clean(value));
}

function isDestination(value: string) {
  return /^(https?:\/\/|mailto:)/i.test(clean(value));
}

export type TicketView =
  | { mode: "link"; href: string; label: string }
  | { mode: "signup"; label: string; href: string }
  | { mode: "pending"; label: string; message: string; previewNote: string };

export function ticketView(path = "/"): TicketView {
  if (tickets.phase === "sales" && isHttp(tickets.checkoutUrl)) {
    return { mode: "link", href: clean(tickets.checkoutUrl), label: "Get Tickets" };
  }

  if (tickets.phase === "updates") {
    const onTicketPage =
      path === "/" || path === "/reverie-and-ember" || path === "/the-evening";
    return {
      mode: "signup",
      label: ticketSignup.buttonLabel,
      href: onTicketPage ? "#tickets" : "/#tickets",
    };
  }

  return {
    mode: "pending",
    label: "Get Tickets",
    message: "Ticket checkout will be linked here when it is ready.",
    previewNote:
      "Preview: this control is inactive and is left off the public page. It does not submit or confirm anything. Set tickets.phase to “sales” and add tickets.checkoutUrl for Get Tickets.",
  };
}

export type HotelView = {
  preview: boolean;
  name: string;
  photo: string;
  photoAlt: string;
  photoWidth: number;
  photoHeight: number;
  groupRate: string;
  reservationDeadline: string;
  bookingUrl: string;
  note: string;
  summary: string;
  showPlaceholderButton: boolean;
  previewNote: string;
};

export function hotelView(): HotelView {
  const bookingUrl = isHttp(hotel.bookingUrl) ? clean(hotel.bookingUrl) : "";

  if (hotel.confirmed) {
    return {
      preview: false,
      name: clean(hotel.name),
      photo: clean(hotel.photo),
      photoAlt: clean(hotel.photoAlt),
      photoWidth: hotel.photoWidth,
      photoHeight: hotel.photoHeight,
      groupRate: clean(hotel.groupRate),
      reservationDeadline: clean(hotel.reservationDeadline),
      bookingUrl,
      note: clean(hotel.note),
      summary: "",
      showPlaceholderButton: false,
      previewNote: "",
    };
  }

  if (isPreview) {
    return {
      preview: true,
      name: clean(hotel.name) || hotelPreview.name,
      photo: clean(hotel.photo) || hotelPreview.photo,
      photoAlt: clean(hotel.photoAlt) || hotelPreview.photoAlt,
      photoWidth: hotel.photoWidth || hotelPreview.photoWidth,
      photoHeight: hotel.photoHeight || hotelPreview.photoHeight,
      groupRate: clean(hotel.groupRate) || hotelPreview.groupRate,
      reservationDeadline:
        clean(hotel.reservationDeadline) || hotelPreview.reservationDeadline,
      bookingUrl,
      note: "",
      summary: "",
      showPlaceholderButton: bookingUrl === "",
      previewNote:
        "Preview only. The public page shows the hotel name, photo, group rate, and reservation deadline after hotel.confirmed is true. View Hotel Details appears only when hotel.bookingUrl is a real link.",
    };
  }

  return {
    preview: false,
    name: "",
    photo: "",
    photoAlt: "",
    photoWidth: 0,
    photoHeight: 0,
    groupRate: "",
    reservationDeadline: "",
    bookingUrl: "",
    note: "",
    summary: publicCopy.hotelPending,
    showPlaceholderButton: false,
    previewNote: "",
  };
}

export function sponsorshipInbox() {
  return isDestination(contacts.sponsorshipUrl) ? clean(contacts.sponsorshipUrl) : "";
}
