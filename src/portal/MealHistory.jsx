import { MEAL_SLOTS } from "./mealSlots";
import StaffGlass from "./StaffGlass";

export default function MealHistory({snapshot,slotCode,onSelectSlot}) {
  const currentHistory = snapshot.data?.requestSlot === slotCode ? snapshot.data : null;
  const slots = currentHistory?.slots || [];
  const currentError = snapshot.error;
  return (
    <StaffGlass label="Meal history">
      <h3>Meals served</h3>
      <p className="portal-card__hint">Choose a meal to view fully served teams. A team appears after every participant has been served.</p>
      <ul className="meal-history__slots">
        {MEAL_SLOTS.map(slot => <li key={slot.code}><button type="button" aria-pressed={slotCode === slot.code} onClick={() => onSelectSlot(slot.code)}>
          <span>{slot.label}</span><strong>{slots.find(item => item.code === slot.code)?.served ?? "—"}</strong><span>View teams →</span>
        </button></li>)}
      </ul>
      <div className="meal-history__head">
        <h4>{MEAL_SLOTS.find(slot => slot.code === slotCode)?.label}</h4>
        {currentHistory && <small>Updated {new Date(currentHistory.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>}
      </div>
      {currentError && <p className="portal-auth__error" role="status">{currentError}</p>}
      {!currentHistory && !currentError && <p role="status">Loading meal history…</p>}
      {currentHistory?.teams.length === 0 && <p className="portal-card__hint">No complete teams for this meal yet. Partial scans remain saved.</p>}
      <div className="meal-history__teams">
        {currentHistory?.teams.map(team => <article className="meal-history__team" key={team.id}>
          <h5>{team.teamName} · {team.teamCode}{team.seatNo != null ? ` · Seat ${team.seatNo}` : ""} · {team.members.length} served</h5>
          <ul>{team.members.map(member => <li key={member.id}>
            <span>{member.name}{member.foodPreference && <span className={`meal-diet${member.foodPreference === "Jain" ? " meal-diet--jain" : ""}`}>{member.foodPreference}</span>}</span>
            <time dateTime={member.givenAt}>{new Date(member.givenAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {member.counter || "Meal counter"}</time>
          </li>)}</ul>
        </article>)}
      </div>
    </StaffGlass>
  );
}
