// Sunday 11 October 2026, 08:20 IST. Writes must pass the database clock gate.
export const SUBMISSION_CLOSES_AT = '2026-10-11T02:50:00.000Z';
export const SUBMISSION_CLOSED_MESSAGE = 'Submissions closed at 8:20 AM IST on 11 October. No further uploads or changes are accepted.';
export const submissionsClosed = (now = Date.now()) => now >= Date.parse(SUBMISSION_CLOSES_AT);
