export function parseTicketNote(note) {
  const value = String(note || "");
  if (!value.startsWith("ticket:")) return null;
  const quantity = Number(value.slice("ticket:".length).split(":")[0]);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return null;
  return quantity;
}

export function summarizeTickets(orders) {
  const paid = orders.filter((order) => order.paymentStatus === "paid");
  const total = (rows, key) => rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
  const square = paid.filter((order) => order.source === "square");
  const manual = paid.filter((order) => order.source === "manual");
  return {
    squareTickets: total(square, "quantity"),
    squareCents: total(square, "amountCents"),
    manualTickets: total(manual, "quantity"),
    manualCents: total(manual, "amountCents"),
    ticketsSold: total(paid, "quantity"),
    revenueCents: total(paid, "amountCents"),
  };
}
