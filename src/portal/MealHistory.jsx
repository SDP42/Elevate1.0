import { useEffect, useState } from "react";
import { MEAL_SLOTS } from "./mealSlots";
import { mealHistory, mealTally } from "./api";

export default function MealHistory({ refreshKey }) {
  const [slotCode, setSlotCode] = useState(MEAL_SLOTS[0].code);
  const [slots, setSlots] = useState([]);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);
  const currentHistory = history?.slot.code === slotCode ? history : null;
  const currentError = error?.slotCode === slotCode ? error.message : "";
  useEffect(() => {
    let live = true, busy = false;
    async function refresh() {
      if (busy || document.hidden) return;
      busy = true;
      const outcomes = await Promise.allSettled([mealTally(), mealHistory(slotCode)]);
      if (live) {
        if (outcomes[0].status === "fulfilled") setSlots(outcomes[0].value.slots);
        if (outcomes[1].status === "fulfilled") { setHistory(outcomes[1].value); setError(null); }
        else setError({ slotCode, message: "Meal history could not refresh. Retrying automatically…" });
      }
      busy = false;
    }
    refresh();
    const timer = setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => { live = false; clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [slotCode, refreshKey]);
  return (
    <section className="portal-card" aria-label="Meal history">
      <h3>Meals served</h3>
      <p className="portal-card__hint">Choose a meal to view served teams. Refreshes in the background every 5 seconds.</p>
      <ul className="meal-history__slots">
        {MEAL_SLOTS.map(slot => <li key={slot.code}><button type="button" aria-pressed={slotCode === slot.code} onClick={() => setSlotCode(slot.code)}>
          <span>{slot.label}</span><strong>{slots.find(item => item.code === slot.code)?.served ?? "—"}</strong><span>View teams →</span>
        </button></li>)}
      </ul>
      <div className="meal-history__head">
        <h4>{MEAL_SLOTS.find(slot => slot.code === slotCode)?.label}</h4>
        {currentHistory && <small>Updated {new Date(currentHistory.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>}
      </div>
      {currentError && <p className="portal-auth__error" role="status">{currentError}</p>}
      {!currentHistory && !currentError && <p role="status">Loading meal history…</p>}
      {currentHistory?.teams.length === 0 && <p className="portal-card__hint">No participants served for this meal yet.</p>}
      <div className="meal-history__teams">
        {currentHistory?.teams.map(team => <article className="meal-history__team" key={team.id}>
          <h5>{team.teamName} · {team.teamCode}{team.seatNo != null ? ` · Seat ${team.seatNo}` : ""} · {team.members.length} served</h5>
          <ul>{team.members.map(member => <li key={member.id}>
            <span>{member.name}{member.foodPreference && <span className={`meal-diet${member.foodPreference === "Jain" ? " meal-diet--jain" : ""}`}>{member.foodPreference}</span>}</span>
            <time dateTime={member.givenAt}>{new Date(member.givenAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {member.counter || "Meal counter"}</time>
          </li>)}</ul>
        </article>)}
      </div>
    </section>
  );
}
