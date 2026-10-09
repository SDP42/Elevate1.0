import { SUBMISSION_CLOSES_AT, SUBMISSION_CLOSED_MESSAGE, submissionsClosed } from '../../shared/submission-schedule.js';
import JSZip from 'jszip';
import { sql as defaultSql } from './db.js';
import { readSession } from './auth.js';
import { logAction as defaultLogAction } from './audit.js';

const LIMIT = 3 * 1024 * 1024;
const TYPES = { pdf: 'application/pdf', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', md: 'text/markdown', txt: 'text/plain' };

export function createSubmissionFiles({sql=defaultSql,logAction=defaultLogAction}={}) {
return async function submissionFiles(req, res) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  res.setHeader('Cache-Control', 'private, no-store');
  const params = new URL(req.url, 'http://localhost').searchParams;
  const teamId = session.role === 'team' ? session.teamId : Number(params.get('teamId'));
  if (!teamId || !['team', 'admin', 'superadmin'].includes(session.role)) {
    return res.status(403).json({ error: 'You cannot access these submissions' });
  }
  if (req.method === 'GET') {
    const id = Number(params.get('fileId'));
    if (id) {
      const rows = await sql`select id, kind, name, mime_type, size, uploaded_at, encode(content, 'base64') as base64 from submission_files where id = ${id} and team_id = ${teamId}`;
      if (!rows.length) return res.status(404).json({ error: 'File not found' });
      return res.status(200).json({ file: rows[0] });
    }
    const files = await sql`select id, kind, name, mime_type, size, uploaded_at from submission_files where team_id = ${teamId} order by uploaded_at desc`;
    return res.status(200).json({ files });
  }
  if (session.role !== 'team') return res.status(403).json({ error: 'Only teams can upload' });
  if (submissionsClosed()) return res.status(403).json({ error: SUBMISSION_CLOSED_MESSAGE });
  const { name, base64 } = req.body || {};
  if (typeof name !== 'string' || typeof base64 !== 'string') return res.status(400).json({ error: 'A file is required' });
  const kind = name.split('.').pop().toLowerCase();
  if (!TYPES[kind]) return res.status(400).json({ error: 'Choose a PDF, PPTX, MD, or TXT file' });
  if (!base64 || base64.length > Math.ceil(LIMIT / 3) * 4 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return res.status(400).json({ error: 'Invalid file or file larger than 3 MB' });
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.toString('base64') !== base64) return res.status(400).json({ error: 'Invalid file encoding' });
  if (!bytes.length || bytes.length > LIMIT) return res.status(413).json({ error: 'Files must be between 1 byte and 3 MB' });
  if (kind === 'pdf' && bytes.subarray(0, 5).toString() !== '%PDF-') return res.status(400).json({ error: 'This is not a PDF file' });
  if (kind === 'pptx') {
    try {
      const zip = await JSZip.loadAsync(bytes);
      if (!zip.file('ppt/presentation.xml') || !zip.file('[Content_Types].xml')) throw new Error();
      // Bound decompressed content before the browser attempts to preview it.
      const entries = Object.values(zip.files).filter(f => !f.dir);
      const expanded = entries.reduce((n, f) => n + (f._data?.uncompressedSize || 0), 0);
      if (entries.length > 2000 || expanded > 30 * 1024 * 1024) throw new Error();
    } catch { return res.status(400).json({ error: 'Invalid PPTX or presentation too complex to preview' }); }
  }
  if (kind === 'md' || kind === 'txt') {
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { return res.status(400).json({ error: 'Text files must use UTF-8 encoding' }); }
    if (bytes.includes(0)) return res.status(400).json({ error: 'Choose a plain text file' });
  }
  const cleanName = name.replace(/[\x00-\x1f/\\]/g, '_').slice(0, 180);
  const [file] = await sql`insert into submission_files (team_id, kind, name, mime_type, size, content)
    select ${teamId}, ${kind}, ${cleanName}, ${TYPES[kind]}, ${bytes.length}, decode(${base64}, 'base64')
    where clock_timestamp() < ${SUBMISSION_CLOSES_AT}::timestamptz
    returning id, kind, name, mime_type, size, uploaded_at`;
  if (!file) return res.status(403).json({ error: SUBMISSION_CLOSED_MESSAGE });
  await sql`update teams set submitted_at = now() where id = ${teamId}`;
  await logAction(session.accountId, 'submission.upload', { teamId, kind, size: bytes.length });
  return res.status(200).json({ file });
}
}
export const submissionFiles=createSubmissionFiles();
