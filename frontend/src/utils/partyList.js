export function mergePartyLists(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const p of list || []) {
      if (p?.id != null) map.set(String(p.id), p);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );
}

/** Re-fetch parties and ensure a newly created row is present in state. */
export async function refreshPartiesAfterCreate(partiesAPI, createdParty) {
  if (!createdParty?.id) {
    throw new Error('Customer saved, but the server response was incomplete. Check the Parties page.');
  }

  let fresh = await partiesAPI.getAll({ activeOnly: true });
  let saved = fresh.find((p) => String(p.id) === String(createdParty.id));

  if (!saved) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    fresh = await partiesAPI.getAll({ activeOnly: true });
    saved = fresh.find((p) => String(p.id) === String(createdParty.id));
  }

  if (!saved) {
    const allParties = await partiesAPI.getAll();
    saved = allParties.find((p) => String(p.id) === String(createdParty.id));
    if (saved) {
      fresh = mergePartyLists(allParties, [saved]);
    }
  }

  if (!saved) {
    try {
      saved = await partiesAPI.getOne(createdParty.id);
    } catch {
      saved = createdParty;
    }
  }

  return {
    party: saved,
    parties: mergePartyLists(fresh, [saved]),
  };
}
