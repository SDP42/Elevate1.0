import crypto from "node:crypto";
import jwt from "jsonwebtoken";

function key() {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required");
  // Scan proofs cannot be used as login sessions, even though both use JWTs.
  return crypto.createHmac("sha256", process.env.SESSION_SECRET).update("elevate-scan-proof-v1").digest("hex");
}
export function issueScanProof(purpose, teamId, accountId, slotCode = null) {
  return jwt.sign({ purpose, teamId, accountId, slotCode, scanId: crypto.randomUUID() }, key(), {
    algorithm: "HS256", expiresIn: "5m", issuer: "elevate-scan", audience: "elevate-counter"
  });
}
export function verifyScanProof(token, purpose, teamId, accountId, slotCode = null) {
  try {
    const proof = jwt.verify(token, key(), { algorithms: ["HS256"], issuer: "elevate-scan", audience: "elevate-counter" });
    return proof.purpose === purpose && proof.teamId === teamId && proof.accountId === accountId && proof.slotCode === slotCode ? proof.scanId : null;
  } catch { return null; }
}
