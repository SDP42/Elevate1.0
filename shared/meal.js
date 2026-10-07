const SLOT = /^d[12]_(breakfast|lunch|evening_snacks|dinner|midnight_snacks)$/;
export function parseQrToken(payload) {
  if (typeof payload !== "string") return null;
  const token = payload.trim().replace(/^ELEVATE1:/, "");
  return /^[a-f0-9]{32,128}$/i.test(token) ? token : null;
}
export function parseMealRequest(body = {}) {
  const { teamId, mealSlotCode, memberIds } = body || {};
  if (!Number.isInteger(teamId) || teamId < 1 || typeof mealSlotCode !== "string" || !SLOT.test(mealSlotCode) ||
      !Array.isArray(memberIds) || !memberIds.length || memberIds.length !== 1 ||
      memberIds.some(id => !Number.isInteger(id) || id < 1) || new Set(memberIds).size !== memberIds.length) {
    throw new Error("Select a valid team, meal slot and one participant for this team QR scan.");
  }
  return { teamId, mealSlotCode, memberIds };
}
