export function parseTicketNote(note: string): number | null;
export function summarizeTickets(orders: {
  paymentStatus: string;
  source: string;
  quantity: number;
  amountCents: number;
}[]): {
  squareTickets: number;
  squareCents: number;
  manualTickets: number;
  manualCents: number;
  ticketsSold: number;
  revenueCents: number;
};
