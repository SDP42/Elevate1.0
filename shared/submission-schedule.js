// Sunday 11 October 2026, 20:40 IST. Writes must pass the database clock gate.
export const SUBMISSION_CLOSES_AT = '2026-10-11T15:10:00.000Z';
export const SUBMISSION_CLOSED_MESSAGE = 'Submissions closed at 8:40 PM IST on 11 October. No further uploads or changes are accepted.';
export const submissionsClosed = (now = Date.now()) => now >= Date.parse(SUBMISSION_CLOSES_AT);
