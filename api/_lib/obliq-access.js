export const OBLIQ_WINNING_TEAMS = new Set(['ELEV05', 'ELEV06', 'ELEV02']);
export const hasObliqAccess = teamCode => OBLIQ_WINNING_TEAMS.has(teamCode);
