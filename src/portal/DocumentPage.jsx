import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Glass, GlassSystemProvider } from 'open-glass-ui';
import useSession from './useSession';
import { submissionFile } from './api';
import { FilePreview } from './SubmissionFiles';

export default function DocumentPage() {
  const { loading, session } = useSession();
  const [params] = useSearchParams();
  const fileId = Number(params.get('fileId')), teamId = Number(params.get('teamId')) || undefined;
  const [state, setState] = useState({ file: null, error: '' });
  const role = session?.role;
  const validFileId = Number.isSafeInteger(fileId) && fileId > 0;
  useEffect(() => {
    if (!role || !validFileId) return;
    let active = true;
    submissionFile(fileId, teamId).then(result => { if (active) setState({file:result.file,error:''}); })
      .catch(error => { if (active) setState({file:null,error:error.message}); });
    return () => { active = false; };
  }, [role, fileId, teamId, validFileId]);
  if (loading) return <div className="portal-loading">Checking your session…</div>;
  if (!session) return <Navigate to="/portal/login" replace />;
  const error = validFileId ? state.error : 'Invalid document link.';
  return <div className="portal-page submission-documentPage">
    <GlassSystemProvider design="liquid" renderer="auto" theme={{appearance:'dark'}} toasts={false}>
      <Glass material="regular" className="submission-documentSurface" look={{ blur:.7, rim:1.4, lensing:1.4 }}>
        <header><span className="submission-previewEyebrow">Elevate 1.0 · Uploaded document</span><h1>{state.file?.name || 'Document viewer'}</h1></header>
        {error && <p role="alert" className="portal-auth__error">{error}</p>}
        {!state.file && !error && <p role="status">Loading document…</p>}
        {validFileId && state.file && <FilePreview file={state.file} teamId={teamId} loadedFile={state.file} />}
      </Glass>
    </GlassSystemProvider>
  </div>;
}
