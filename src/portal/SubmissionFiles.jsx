import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import { submissionFile, submissionFiles, uploadSubmission } from './api';

const LIMIT = 3 * 1024 * 1024;
const bytesFromBase64 = value => Uint8Array.from(atob(value.replace(/\s/g, '')), c => c.charCodeAt(0));
const parseXml = text => new DOMParser().parseFromString(text, 'application/xml');
const nodes = (el, tag) => Array.from(el.getElementsByTagNameNS('*', tag));

async function readSlides(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));
  if (!names.length || names.length > 150) throw new Error('This presentation cannot be previewed (maximum 150 slides).');
  const slides = [];
  for (const name of names) {
    const doc = parseXml(await zip.file(name).async('string'));
    const paragraphs = nodes(doc, 'p').map(p => nodes(p, 't').map(t => t.textContent).join('')).filter(Boolean);
    const relFile = zip.file(name.replace('slides/', 'slides/_rels/') + '.rels');
    const images = [];
    if (relFile) {
      const rels = nodes(parseXml(await relFile.async('string')), 'Relationship');
      for (const pic of nodes(doc, 'pic')) {
        const blip = nodes(pic, 'blip')[0];
        const embed = blip?.getAttribute('r:embed');
        const rel = rels.find(r => r.getAttribute('Id') === embed && r.getAttribute('TargetMode') !== 'External');
        const target = rel?.getAttribute('Target');
        // Only embedded raster assets are loaded; never fetch deck links.
        if (!target || !/^\.\.\/media\/[\w .-]+\.(png|jpe?g|gif|webp)$/i.test(target)) continue;
        const asset = zip.file('ppt/' + target.slice(3));
        if (!asset) continue;
        const ext = target.split('.').pop().toLowerCase();
        images.push(`data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${await asset.async('base64')}`);
      }
    }
    slides.push({ paragraphs, images });
  }
  return slides;
}

function PdfViewer({ bytes }) {
  const canvas = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let task;
    (async () => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false });
      const document = await task.promise;
      if (active) { setPdf(document); setPage(1); }
    })().catch(() => { if (active) setError('Unable to preview this PDF. Download it to open in your PDF reader.'); });
    return () => { active = false; task?.destroy(); };
  }, [bytes]);
  useEffect(() => {
    if (!pdf) return;
    let active = true;
    let render;
    pdf.getPage(page).then(p => {
      if (!active || !canvas.current) return;
      const viewport = p.getViewport({ scale: Math.min(1.5, 1000 / p.getViewport({ scale: 1 }).width) });
      canvas.current.width = viewport.width;
      canvas.current.height = viewport.height;
      render = p.render({ canvasContext: canvas.current.getContext('2d'), viewport });
      return render.promise;
    }).catch(e => { if (active && e.name !== 'RenderingCancelledException') setError('Unable to display this page.'); });
    return () => { active = false; render?.cancel(); };
  }, [pdf, page]);
  return <div>{error ? <p role="alert">{error}</p> : <>
    {pdf ? <div className="submission-viewer__nav"><button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {pdf.numPages}</span><button type="button" disabled={page >= pdf.numPages} onClick={() => setPage(p => p + 1)}>Next</button></div> : <p>Loading PDF…</p>}
    <canvas className="submission-viewer__pdf" ref={canvas} aria-label={`PDF page ${page}`} />
  </>}</div>;
}

function FilePreview({ file, localFile, teamId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    let active = true;
    let blobUrl;
    setData(null); setError(''); setSlide(0);
    (async () => {
      const saved = localFile ? null : (await submissionFile(file.id, teamId)).file;
      const bytes = localFile ? new Uint8Array(await localFile.arrayBuffer()) : bytesFromBase64(saved.base64);
      const kind = file.kind;
      const text = ['md', 'txt'].includes(kind) ? new TextDecoder().decode(bytes) : '';
      const slides = kind === 'pptx' ? await readSlides(bytes) : null;
      blobUrl = URL.createObjectURL(new Blob([bytes], { type: saved?.mime_type || localFile?.type || 'application/octet-stream' }));
      if (active) setData({ bytes, text, slides, url: blobUrl });
      else URL.revokeObjectURL(blobUrl);
    })().catch(e => { if (active) setError(e.message || 'Unable to preview file.'); });
    return () => { active = false; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [file.id, file.kind, localFile, teamId]);
  if (error) return <p role="alert" className="portal-auth__error">{error}</p>;
  if (!data) return <p>Loading preview…</p>;
  return <div className="submission-viewer">
    <a href={data.url} download={file.name}>Download {file.name}</a>
    {file.kind === 'pdf' && <PdfViewer bytes={data.bytes} />}
    {file.kind === 'md' && <article className="submission-viewer__document"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{ img: () => <span>[image omitted from preview]</span>, a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{data.text}</Markdown></article>}
    {file.kind === 'txt' && <pre className="submission-viewer__document">{data.text}</pre>}
    {file.kind === 'pptx' && <>
      <div className="submission-viewer__nav"><button type="button" disabled={slide === 0} onClick={() => setSlide(s => s - 1)}>Previous</button><span>Slide {slide + 1} of {data.slides.length}</span><button type="button" disabled={slide === data.slides.length - 1} onClick={() => setSlide(s => s + 1)}>Next</button></div>
      <p className="portal-card__hint">Slide content preview. Download the original for PowerPoint formatting and animations.</p>
      <article className="submission-viewer__document submission-viewer__slide">
        {data.slides[slide].paragraphs.map((p, i) => i === 0 ? <h4 key={i}>{p}</h4> : <p key={i}>{p}</p>)}
        {data.slides[slide].images.map((src, i) => <img key={i} src={src} alt={`Slide ${slide + 1} image ${i + 1}`} />)}
        {!data.slides[slide].paragraphs.length && !data.slides[slide].images.length && <p>No text or raster images on this slide.</p>}
      </article>
    </>}
  </div>;
}

function CommonUpload({ onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);
  async function choose(e) {
    const selected = e.target.files[0];
    setError('');
    if (!selected) return;
    const kind = selected.name.split('.').pop().toLowerCase();
    if (!['pdf', 'pptx', 'md', 'txt'].includes(kind) || !selected.size || selected.size > LIMIT) {
      setError('Choose a PDF, PPTX, MD, or TXT file up to 3 MB.'); e.target.value = ''; return;
    }
    setBusy(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(selected);
      });
      const result = await uploadSubmission(selected.name, base64);
      onSaved(result.file);
      input.current.value = '';
    } catch (e) { setError(e.message || 'Upload failed. Choose the file again to retry.'); }
    finally { setBusy(false); }
  }
  return <div className="submission-upload">
    <label className="portal-field"><span>Upload document · PDF, PPTX, MD, TXT · max 3 MB</span><input ref={input} type="file" accept=".pdf,.pptx,.md,.txt" disabled={busy} onChange={choose} /></label>
    {busy && <p role="status">Uploading document…</p>}
    {error && <p role="alert" className="portal-auth__error">{error}</p>}
  </div>;
}

export default function SubmissionFiles({ teamId, editable = false, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [openedFile, setOpenedFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    submissionFiles(teamId).then(result => { if (active) setFiles(result.files); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [teamId]);
  if (loading) return <p>Loading uploaded files…</p>;
  return <div className="submission-files">
    {error && <p role="alert" className="portal-auth__error">{error}</p>}
    {editable && <CommonUpload onSaved={file => { setFiles(fs => [...fs.filter(f => f.kind !== file.kind), file]); setOpenedFile(file.id); onUploaded?.(file); }} />}
    {files.map(file => <details key={`${file.id}-${file.uploaded_at}`} open={openedFile === file.id || undefined}><summary>{file.name} · {Math.ceil(file.size / 1024)} KB</summary><LazyPreview file={file} teamId={teamId} /></details>)}
    {!editable && !files.length && <p>No uploaded files.</p>}
  </div>;
}

function LazyPreview({ file, teamId }) {
  const anchor = useRef(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const details = anchor.current?.closest('details');
    const toggle = () => setShow(details.open);
    if (details) setShow(details.open);
    details?.addEventListener('toggle', toggle);
    return () => details?.removeEventListener('toggle', toggle);
  }, []);
  return <div ref={anchor}>{show && <FilePreview file={file} teamId={teamId} />}</div>;
}
