export const PAYMENT_METHODS = [
  { id: "online", label: "Online (UPI)" },
  { id: "cash", label: "Cash" },
];

export const FUNDING_SOURCES = [
  { id: "capital", label: "Capital account", hint: "Doesn't change your balances" },
  { id: "collection", label: "Collection account", hint: "Taken from the account balance" },
  { id: "cash", label: "Cash", hint: "Taken from cash in hand" },
];

export const fundingLabel = (id) => FUNDING_SOURCES.find((s) => s.id === id)?.label || "Collection account";
