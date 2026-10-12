import { requireRole } from './_lib/auth.js';
import { sql } from './_lib/db.js';
import { hasObliqAccess } from './_lib/obliq-access.js';

export default requireRole(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const [team] = await sql`select team_code from teams where id=${req.session.teamId} and not withdrawn`;
  if (!hasObliqAccess(team?.team_code)) return res.status(403).json({ error: 'This opportunity is available only to the three winning teams.' });
  if (req.body?.acknowledged !== true) return res.status(400).json({ error: 'Please acknowledge the confidentiality terms before continuing.' });
  if (req.body?.resource === 'xyz') return res.status(200).json({ code: 'EVT26', guideUrl: 'https://drive.google.com/file/d/1lh6gndYIuzWm0oBF3ZND_2M6RqgNesVA/view' });
  return res.status(200).json({ url: 'https://forms.gle/XKT6JkAsUWJ6evso7' });
}, ['team']);
