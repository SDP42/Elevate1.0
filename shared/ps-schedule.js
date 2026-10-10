// Organizer opened selection early on 10 October 2026.
// The server clock remains authoritative.
export const PS_SELECTION_OPENS_AT = '2026-10-09T18:30:00.000Z';

export const PS_SELECTION_CLOSES_AT = '2026-10-10T04:30:00.000Z';

export function psSelectionSchedule(now = Date.now()) {
  return {
    opensAt: PS_SELECTION_OPENS_AT,
    closesAt: PS_SELECTION_CLOSES_AT,
    selectionClosed: now >= Date.parse(PS_SELECTION_CLOSES_AT),
    serverNow: new Date(now).toISOString(),
    selectionOpen: now >= Date.parse(PS_SELECTION_OPENS_AT) && now < Date.parse(PS_SELECTION_CLOSES_AT),
  };
}
