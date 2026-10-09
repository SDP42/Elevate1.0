import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Glass, GlassSystemProvider } from 'open-glass-ui';
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

export function FilePreview({ file, localFile, teamId, loadedFile }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    let active = true;
    let blobUrl;
    setData(null); setError(''); setSlide(0);
    (async () => {
      const saved = localFile ? null : loadedFile || (await submissionFile(file.id, teamId)).file;
      const bytes = localFile ? new Uint8Array(await localFile.arrayBuffer()) : bytesFromBase64(saved.base64);
      const kind = file.kind;
      const text = ['md', 'txt'].includes(kind) ? new TextDecoder().decode(bytes) : '';
      const slides = kind === 'pptx' ? await readSlides(bytes) : null;
      blobUrl = URL.createObjectURL(new Blob([bytes], { type: saved?.mime_type || localFile?.type || 'application/octet-stream' }));
      if (active) setData({ bytes, text, slides, url: blobUrl });
      else URL.revokeObjectURL(blobUrl);
    })().catch(e => { if (active) setError(e.message || 'Unable to preview file.'); });
    return () => { active = false; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [file.id, file.kind, localFile, teamId, loadedFile]);
  if (error) return <p role="alert" className="portal-auth__error">{error}</p>;
  if (!data) return <p>Loading preview…</p>;
  return <div className="submission-viewer">
    <a href={data.url} download={file.name}>Download original</a>
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

function CommonUpload({ onSaved, closed }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);
  const [progress, setProgress] = useState('');
  async function choose(e) {
    const selected = Array.from(e.target.files || []);
    setError('');
    if (!selected.length) return;
    if (selected.some(file => !['pdf', 'pptx', 'md', 'txt'].includes(file.name.split('.').pop().toLowerCase()) || !file.size || file.size > LIMIT)) {
      setError('Each document must be a PDF, PPTX, MD, or TXT file up to 3 MB.'); e.target.value = ''; return;
    }
    setBusy(true);
    let completed = 0;
    try {
      for (const file of selected) {
        setProgress(`Uploading ${completed + 1} of ${selected.length} documents…`);
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file);
        });
        const result = await uploadSubmission(file.name, base64);
        onSaved(result.file); completed++;
      }
    } catch (err) { setError(`${completed} document(s) saved. ${err.message || 'Upload failed.'} Choose the remaining files to retry.`); }
    finally { setBusy(false); setProgress(''); if (input.current) input.current.value = ''; }
  }
  return <div className="submission-upload">
    <label className="portal-field"><span>Upload documents · PDF, PPTX, MD, TXT · max 3 MB each</span><input ref={input} type="file" multiple accept=".pdf,.pptx,.md,.txt" disabled={busy || closed} onChange={choose} /></label>
    {busy && <p role="status">{progress}</p>}
    {error && <p role="alert" className="portal-auth__error">{error}</p>}
  </div>;
}

export default function SubmissionFiles({ teamId, editable = false, closed = false, compact = false, onUploaded }) {
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
  if (compact) return <div className="submission-compact">
    {error && <p role="alert" className="portal-auth__error">{error}</p>}
    {!files.length && !error && <span className="portal-table__sub">—</span>}
    <GlassSystemProvider design="liquid" renderer="auto" theme={{ appearance: 'dark' }} toasts={false}>
      <ul className="submission-documentButtons">{files.map(file => <li key={file.id}>
        <Glass material="regular" className="submission-documentGlass" look={{ blur: .6, rim: 1.4, lensing: 1.4 }}>
          <a href={`/portal/document?fileId=${file.id}&teamId=${teamId}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${file.name} in a new tab`} title={file.name}>
            <span className="submission-documentKind">{file.kind.toUpperCase()}</span>
            <span className="submission-documentName"><span className="submission-documentTrack"><span>{file.name}</span><span aria-hidden="true">{file.name}</span></span></span>
            <span className="submission-documentArrow" aria-hidden="true">↗</span>
          </a>
        </Glass>
      </li>)}</ul>
    </GlassSystemProvider>
  </div>;
  return <div className="submission-files">
    {error && <p role="alert" className="portal-auth__error">{error}</p>}
    {editable && <CommonUpload closed={closed} onSaved={file => { setFiles(fs => [file, ...fs]); onUploaded?.(file); }} />}
    <ul className="submission-fileList">
      {files.map(file => <li className="submission-fileRow" key={file.id}>
        <span className="submission-fileRow__type" aria-hidden="true">{file.kind.toUpperCase()}</span>
        <div className="submission-fileRow__info"><span className="submission-fileRow__name">{file.name}</span><span className="submission-fileRow__size">{Math.ceil(file.size / 1024)} KB</span></div>
        <button className="submission-fileRow__preview" type="button" onClick={() => setOpenedFile(file)} aria-label={`Preview ${file.name}`}>Preview</button>
      </li>)}
    </ul>
    {openedFile && <PreviewPopup file={openedFile} teamId={teamId} onClose={() => setOpenedFile(null)} />}
    {!editable && !files.length && <p>No uploaded files.</p>}
  </div>;
}

export function PreviewPopup({ file, teamId, localFile, onClose }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement;
    const element = dialog.current;
    element.showModal();
    return () => { element.close(); opener?.focus?.(); };
  }, []);
  return createPortal(
    <dialog ref={dialog} className="submission-previewDialog" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <GlassSystemProvider renderer="auto" theme={{ appearance: "dark" }} toasts={false}>
        <Glass material="frosted" className="submission-previewGlass" look={{ blur: .9, rim: 1.2 }}>
          <header className="submission-previewHeader"><div><span className="submission-previewEyebrow">Document preview · {file.kind.toUpperCase()}</span><h2 id={titleId}>{file.name}</h2></div><button type="button" className="submission-previewClose" onClick={onClose} aria-label="Close preview">Close <span aria-hidden="true">×</span></button></header>
          <div className="submission-previewBody"><FilePreview file={file} teamId={teamId} localFile={localFile} /></div>
        </Glass>
      </GlassSystemProvider>
    </dialog>, document.body
  );
}
