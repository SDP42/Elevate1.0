// 10 October 2026, 09:30 IST. The server clock is authoritative.
export const PS_SELECTION_OPENS_AT = '2026-10-10T04:00:00.000Z';

export function psSelectionSchedule(now = Date.now()) {
  return {
    opensAt: PS_SELECTION_OPENS_AT,
    serverNow: new Date(now).toISOString(),
    selectionOpen: now >= Date.parse(PS_SELECTION_OPENS_AT),
  };
}
