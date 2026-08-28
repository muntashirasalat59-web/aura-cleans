/** Guess a city name from a stored party address (last short comma/line segment). */
export function cityGuessFromAddress(address) {
  const raw = String(address || '').trim();
  if (!raw) return '';
  const parts = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const cleaned = parts[i].replace(/\b\d{6}\b/g, '').replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned.length > 48) continue;
    return cleaned;
  }
  return '';
}

export function shipToFromParty(party) {
  const address = String(party?.address || '').trim();
  return {
    ship_to_city: cityGuessFromAddress(address),
    ship_to_address: address,
  };
}

export function shipToMatchesParty(city, address, party) {
  const from = shipToFromParty(party);
  const filled = Boolean(from.ship_to_city || from.ship_to_address);
  if (!filled) return false;
  return (
    String(city || '').trim() === from.ship_to_city &&
    String(address || '').trim() === from.ship_to_address
  );
}
