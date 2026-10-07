export function teamCode(number) {
  if (!Number.isSafeInteger(number) || number < 1 || number > 9999) throw new Error("Invalid team number");
  return `ELEV${String(number).padStart(2, "0")}`;
}

export function issuedTeamNumber(username) {
  const match = /^(?:team|elev)(\d{2,4})$/i.exec(String(username));
  return match && Number(match[1]) > 0 ? Number(match[1]) : null;
}
