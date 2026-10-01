// Mirrors the meal_slots rows seeded in db/schema.sql — kept here too so the
// meal counter's slot picker doesn't need an extra round trip just to list
// seven fixed, known-in-advance options.
export const MEAL_SLOTS = [
  { code: "d1_breakfast", label: "Day 1 — Breakfast" },
  { code: "d1_lunch", label: "Day 1 — Lunch" },
  { code: "d1_evening_snacks", label: "Day 1 — Evening snacks" },
  { code: "d1_dinner", label: "Day 1 — Dinner" },
  { code: "d1_midnight_snacks", label: "Day 1 — Midnight snacks" },
  { code: "d2_breakfast", label: "Day 2 — Breakfast" },
  { code: "d2_lunch", label: "Day 2 — Lunch" },
];
