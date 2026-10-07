"""Validate the final CSV; enrich only exact participant matches from RSVP JSON.
Private output only. The CSV order defines ELEV01–ELEV32.
"""
import csv
import hashlib
import json
import re
import sys
from pathlib import Path
from db.prepare_rsvp import clean, key, phone, private_json

EMPTY = {"", "-", "na", "n/a", "none"}

def prepare_finalists(csv_path, previous=None):
    with Path(csv_path).open(encoding="utf-8-sig") as source:
        rows = list(csv.DictReader(source))
    names = ["Full name", "Full Name", "Full Name 2", "Full Name 3"]
    foods = ["Member 1", "Member 2", "Member 3 (if any)", "Member 4 (if any)"]
    required = ["Team name", *names, *foods, "Email Address", "Phone Number"]
    if len(rows) != 32 or any(header not in rows[0] for header in required):
        raise ValueError("Expected 32 finalists and the participant CSV headers")
    old_teams = {key(t["teamName"]): t for t in (previous or {}).get("teams", [])}
    seen_teams, seen_emails, teams = set(), set(), []
    for index, row in enumerate(rows, 1):
        team_name = clean(row["Team name"])
        if not team_name or key(team_name) in seen_teams:
            raise ValueError(f"Row {index+1}: empty or duplicate team")
        seen_teams.add(key(team_name))
        old = old_teams.get(key(team_name), {})
        members = []
        for position, (name_column, food_column) in enumerate(zip(names, foods), 1):
            raw_name = clean(row[name_column])
            if raw_name.lower() in EMPTY:
                continue
            suffix = "" if position == 1 else f" {position}"
            email = clean(row["Email Address" + suffix]).lower()
            number = phone(row["Phone Number" + suffix])
            food = clean(row[food_column]).title()
            identity_matches = [m for m in old.get("members", []) if key(m["name"]) == key(raw_name) and m.get("phone") == number]
            if not email and len(identity_matches) == 1:
                email = identity_matches[0].get("email") or ""
            if email and (not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or email in seen_emails):
                raise ValueError(f"{team_name} member {position}: invalid or duplicate email")
            if not re.fullmatch(r"\+91\d{10}", number or "") or food not in ("Veg", "Jain"):
                raise ValueError(f"{team_name} member {position}: invalid phone or food preference")
            if email: seen_emails.add(email)
            matches = [m for m in old.get("members", []) if (email and m.get("email") == email or m.get("phone") == number) and key(m["name"]) == key(raw_name)]
            profile = matches[0] if len(matches) == 1 else {}
            members.append({"position": position, "name": raw_name.title(), "isLead": position == 1,
                            "email": email or None, "phone": number, "foodPreference": food,
                            "college": profile.get("college"), "yearBranch": profile.get("yearBranch")})
        if not 2 <= len(members) <= 4 or [m["position"] for m in members] != list(range(1,len(members)+1)):
            raise ValueError(f"{team_name}: roster must contain 2–4 contiguous members, leader first")
        teams.append({"teamName": team_name, "sourceRow": index+1, "declaredSize": len(members),
                      "members": members, "issues": [], "attending": True,
                      "respondedAt": old.get("respondedAt"), "respondentEmail": old.get("respondentEmail"),
                      "paymentPayers": old.get("paymentPayers", []), "termsConfirmation": old.get("termsConfirmation"),
                      "declaration": old.get("declaration")})
    data = {"version": 1, "sourceHash": hashlib.sha256(Path(csv_path).read_bytes()).hexdigest(),
            "sourceSheet": "Finalists CSV", "teams": teams}
    if "drive.google.com" in json.dumps(data).lower():
        raise ValueError("Drive links must not be imported")
    return data

if __name__ == "__main__":
    source, previous_path, output_path = sys.argv[1:]
    data = prepare_finalists(source, json.loads(Path(previous_path).read_text()))
    private_json(output_path, data)
    print(json.dumps({"teams": len(data["teams"]), "participants": sum(len(t["members"]) for t in data["teams"]),
                      "enrichedProfiles": sum(bool(m["college"] and m["yearBranch"]) for t in data["teams"] for m in t["members"])}))
