// Round 2 judging rubric — shared verbatim between the frontend (marks
// entry form) and the backend (api/core.js, to validate and total a
// submission), so the two can never drift out of sync on what the
// criteria are or what each one maxes out at.
//
// A reasonable default hackathon rubric, 25 points each to 100 total —
// tell me the real one if the organisers already have a fixed rubric and
// this should edit to match it.
export const CRITERIA = [
  { key: "innovation", label: "Innovation", max: 25 },
  { key: "technical", label: "Technical Execution", max: 25 },
  { key: "presentation", label: "Presentation", max: 25 },
  { key: "impact", label: "Impact & Feasibility", max: 25 },
];

export const MAX_TOTAL = CRITERIA.reduce((sum, c) => sum + c.max, 0);
