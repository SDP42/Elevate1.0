# Elevate 1.0 — what to build next

Notes on where the site stands and what would genuinely improve it, ranked by
value rather than by how fun it is to build. Everything is framed in the
aviation language the site already speaks, so additions feel native rather
than bolted on.

---

## 1. What exists today

| Section | Purpose | State |
|---|---|---|
| Hero | Cabin fly-through → cloud flight → the brief | Done |
| Boarding pass | Ticket with flight/date/gate | Done |
| Departure board | Schedule as split-flap departures | Done |
| Prize runway | Three jets landing on 24L/24C/24R | Done |
| Stats bar | Dates, format, countdown | Done |
| Domains | "Revealed soon" holding panel | Placeholder |
| Timeline + globe | 15-stop schedule ringed on a rotating Earth | Done |
| Safety card | Six illustrated rules | Done |
| Who flies | Open-to-all-branches + stats | Done |
| Perks | Four benefit tiles | Done |
| Register | Unstop CTA | Waiting on link |

---

## 2. The real gaps

These are ordered by how much grief each one saves the organising team. The
top four are the ones people will message you about if they are missing.

### P0 — before launch

**FAQ.** The single highest-value addition. Every question not answered here
becomes a DM. Cover: Do I need a team beforehand? Can I join solo? Is it
free? Is it open to other colleges? First years? What do I bring? Is there
overnight stay? Food? Travel reimbursement? Certificates?
*Aviation frame:* "Cabin questions" or "Before you fly".
*Effort:* small — accordion, ~12 entries.

**Venue & getting there.** People genuinely need this: campus address,
nearest station (Vile Parle), gate to enter, which building, reporting time.
An embedded map or a clean static map image.
*Aviation frame:* "Terminal guide" / "Airport information".
*Effort:* small.

**Rules, eligibility & code of conduct.** Needed for legitimacy and to settle
disputes. Team size, what can be pre-built, plagiarism policy, AI-tool policy
(worth being explicit in 2026), conduct expectations, decision finality.
*Aviation frame:* "Conditions of carriage".
*Effort:* small–medium, mostly copy.

**Social & community links.** Where do announcements actually happen? An
Instagram handle and a WhatsApp/Discord invite. Without this, registrants have
no channel between registering and arriving.
*Aviation frame:* "Stay in contact" strip, or fold into the footer.
*Effort:* tiny.

### P1 — strong credibility wins

**Judges & mentors.** Names, photos, one-line affiliations. This is the
single biggest signal that an event is serious, and it is what sponsors and
faculty look at.
*Aviation frame:* "Flight crew" — crew cards with rank stripes.
*Effort:* medium (needs photos and bios from you).

**Sponsors / partners.** Even a single logo row. If you are still pitching
sponsors, having the slot designed and ready is itself a selling point.
*Aviation frame:* "Codeshare partners".
*Effort:* small once assets exist.

**Judging criteria.** What are the weightings — innovation, execution,
impact, presentation? Teams optimise for what you publish, and publishing it
makes judging defensible afterwards.
*Aviation frame:* "Landing checklist" — a pre-landing checklist card.
*Effort:* small.

**What to bring.** Laptop, charger, extension board, college ID, water
bottle, any hardware. Also what *not* to bring.
*Aviation frame:* "Baggage allowance" — carry-on vs restricted items, in the
same pictogram style as the safety card. Pairs beautifully with it.
*Effort:* small, reuses safety-card styling.

### P2 — nice, once the above is done

**Live seat map.** Sixty team slots drawn as an aircraft seat map, filling as
registrations come in. Creates real urgency and is the most on-theme idea
here. Can start static ("42 of 60 seats remaining") and become live later.
*Effort:* medium. High visual payoff.

**Organising committee.** The DJS NSDC team behind it.
*Aviation frame:* "Ground crew".

**Domain reveal countdown.** While domains are TBA, a live countdown to the
reveal turns a weakness into a hook.
*Effort:* small — the countdown logic already exists in `StatsBar`.

**Submission guidelines.** What to submit, where, format, deadline.
Could live inside the timeline as an expandable stop.

**Certificates & takeaways.** What every participant walks away with.
*Aviation frame:* "Frequent flyer benefits".

### P3 — stretch

- **Past-edition gallery** — not applicable for 1.0, but design the slot for 2.0.
- **Team finder** — a board for solo registrants seeking teams. High value but
  needs moderation; a WhatsApp group may cover it more cheaply.
- **Live day-of mode** — swap the hero for a live clock and current-stage
  banner during the event itself.

---

## 3. Non-feature work worth doing

These are not sections, but they matter more than another section would.

**Open Graph / share tags.** Currently missing. When someone shares the link
on WhatsApp or Instagram it will render as a bare URL with no image. For an
event that spreads by sharing, this is arguably P0. Needs `og:title`,
`og:description`, `og:image` (1200×630) in `index.html`.

**Favicon.** Still the Vite default.

**Mobile pass.** Most students will open this on a phone. The hero is built
around a wide flanking layout; it stacks below 900px but has not been
properly reviewed on a real device.

**Performance.** The cloud fields and globe use `feTurbulence`, which is
expensive. Worth checking on a mid-range Android before launch. If it
struggles, the fallback is rendering the noise once to a raster rather than
live-filtering.

**Reduced motion.** Partially handled on the globe. The hero scroll
choreography should also respect `prefers-reduced-motion`.

**Analytics.** Even basic page-view counts will tell you which sections people
actually reach.

---

## 4. Suggested order

1. OG tags + favicon *(an hour, unblocks sharing)*
2. FAQ
3. Venue & getting there
4. Rules / code of conduct
5. Social + community links
6. Judging criteria + what to bring *(pair them, shared styling)*
7. Judges & mentors *(as soon as names are confirmed)*
8. Sponsors *(as soon as confirmed)*
9. Seat map
10. Mobile + performance pass before launch

---

## 5. My pick, if you only do three

**FAQ**, **venue**, and **OG tags**. They are unglamorous, but they are the
three that decide whether someone who sees the link actually turns up on
10 October. The seat map is the one I would build next for pure impact — it is
the most on-theme idea on this list and it creates urgency without saying
anything pushy.
