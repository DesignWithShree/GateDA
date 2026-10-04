import React, { useEffect, useMemo, useState } from 'react'
import { Folder, FolderPlus, Upload, Search, Trash2, ExternalLink, Eye, Download, FolderInput, MoveRight, File as FileIcon } from 'lucide-react'
import { get, post, del, fileUrl } from '../api'
import { useToast } from '../components/Toast.jsx'
import Empty from '../components/Empty.jsx'

function humanSize(n) {
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}

export default function Library({ refresh }) {
  const toast = useToast()
  const [data, setData] = useState({ folders: [''], files: [] })
  const [folder, setFolder] = useState('')
  const [q, setQ] = useState('')
  const [newFolder, setNewFolder] = useState('')
  const [importSrc, setImportSrc] = useState('')
  const [preview, setPreview] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [moveFile, setMoveFile] = useState(null)
  const [moveDest, setMoveDest] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const load = () => get('/library').then(setData).catch(() => {})
  useEffect(() => { load() }, [])

  const files = useMemo(() => {
    if (q.trim()) return data.files.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))
    return data.files.filter((f) => f.folder === folder)
  }, [data, folder, q])

  const upload = async (fileList) => {
    if (!fileList.length) return
    const fd = new FormData()
    fd.append('folder', folder)
    for (const f of fileList) fd.append('files', f)
    await post('/library/upload', fd)
    toast(`Uploaded ${fileList.length} file(s)`, 'success')
    load(); refresh?.()
  }

  const createFolder = async () => {
    if (!newFolder.trim()) return
    const path = folder ? `${folder}/${newFolder.trim()}` : newFolder.trim()
    await post('/library/folder', { path })
    setFolder(path); setNewFolder('')
    load()
  }

  const doImport = async () => {
    if (!importSrc.trim()) return
    try {
      await post('/library/import', { src: importSrc.trim(), folder })
      toast('Imported', 'success'); setImportSrc(''); load(); refresh?.()
    } catch (e) { toast(e.message, 'error') }
  }

  const doDelete = async (path) => {
    await del(`/library/file?path=${encodeURIComponent(path)}`)
    setConfirmDel(null); if (preview === path) setPreview(null)
    load(); refresh?.()
  }

  const deleteFolder = async () => {
    if (!folder) return
    await fetch(`/api/library/folder?path=${encodeURIComponent(folder)}`, { method: 'DELETE' })
    setFolder(''); load()
  }

  const doMove = async () => {
    try {
      await post('/library/move', { path: moveFile, dest_folder: moveDest })
      setMoveFile(null); load(); toast('Moved', 'success')
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Resource Library</h1>
        <p className="mt-1 text-sm text-slate-400">Your PDFs and notes, organised by subject — no more digging through Finder.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* folder tree */}
        <div className="card space-y-1 p-3">
          <button onClick={() => setFolder('')} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${folder === '' ? 'bg-brand-500/10 font-semibold text-brand-600 dark:text-brand-300' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}>
            <Folder size={14} /> All files
          </button>
          {data.folders.filter(Boolean).map((f) => (
            <button key={f} onClick={() => setFolder(f)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${folder === f ? 'bg-brand-500/10 font-semibold text-brand-600 dark:text-brand-300' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
              style={{ paddingLeft: `${10 + f.split('/').length * 10}px` }}>
              <Folder size={14} /> {f.split('/').pop()}
            </button>
          ))}
          <div className="mt-2 flex gap-1.5 border-t border-slate-100 pt-2 dark:border-white/10">
            <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="New folder" className="input !py-1.5 text-xs" onKeyDown={(e) => e.key === 'Enter' && createFolder()} />
            <button onClick={createFolder} className="btn-ghost !px-2.5"><FolderPlus size={14} /></button>
          </div>
          {folder && (
            <button onClick={deleteFolder} className="btn-danger mt-1 w-full !py-1.5 text-xs"><Trash2 size={12} /> Delete this folder</button>
          )}
          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-white/10">
            <div className="mb-1.5 text-xs font-semibold text-slate-400">Import from this Mac</div>
            <input value={importSrc} onChange={(e) => setImportSrc(e.target.value)} placeholder="~/Documents/GATE/DA" className="input !py-1.5 text-xs" onKeyDown={(e) => e.key === 'Enter' && doImport()} />
            <button onClick={doImport} className="btn-ghost mt-1.5 w-full !py-1.5 text-xs"><FolderInput size={13} /> Import into "{folder || 'root'}"</button>
          </div>
        </div>

        {/* files */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all files…" className="input !pl-8" />
            </div>
            <label className="btn-primary cursor-pointer">
              <Upload size={15} /> Upload
              <input type="file" multiple className="hidden" onChange={(e) => upload([...e.target.files])} />
            </label>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); upload([...e.dataTransfer.files]) }}
            className={`card min-h-[220px] p-2 transition ${dragOver ? 'ring-2 ring-brand-500' : ''}`}>
            {files.length === 0 ? (
              <Empty icon={Upload} title="Drop files here or click Upload" hint={`Uploading into "${folder || 'root'}"`} />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {files.map((f) => (
                  <div key={f.path} className="flex flex-wrap items-center gap-2 px-2 py-2.5">
                    <FileIcon size={16} className="shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{f.name}</div>
                      <div className="truncate text-xs text-slate-400">{f.folder || 'root'} · {humanSize(f.size)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {f.name.toLowerCase().endsWith('.pdf') && (
                        <button onClick={() => setPreview(f.path)} className="btn-ghost !px-2 !py-1.5" title="Preview"><Eye size={14} /></button>
                      )}
                      <a href={fileUrl(f.path)} target="_blank" rel="noreferrer" className="btn-ghost !px-2 !py-1.5" title="Open"><ExternalLink size={14} /></a>
                      <a href={fileUrl(f.path, true)} className="btn-ghost !px-2 !py-1.5" title="Download"><Download size={14} /></a>
                      <button onClick={() => { setMoveFile(f.path); setMoveDest('') }} className="btn-ghost !px-2 !py-1.5" title="Move"><MoveRight size={14} /></button>
                      <button onClick={() => setConfirmDel(f.path)} className="btn-ghost !px-2 !py-1.5 text-rose-500" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {preview && (
            <div className="card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="truncate text-sm font-semibold">{preview}</span>
                <button onClick={() => setPreview(null)} className="btn-ghost !px-2 !py-1 text-xs">Close</button>
              </div>
              <iframe src={fileUrl(preview)} title="preview" className="h-[70vh] w-full rounded-xl border border-slate-200 dark:border-white/10" />
            </div>
          )}
        </div>
      </div>

      {confirmDel && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" onClick={() => setConfirmDel(null)}>
          <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 text-sm">Delete <b>{confirmDel.split('/').pop()}</b> permanently?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(null)} className="btn-ghost">Cancel</button>
              <button onClick={() => doDelete(confirmDel)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}

      {moveFile && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" onClick={() => setMoveFile(null)}>
          <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-sm">Move <b>{moveFile.split('/').pop()}</b> to:</p>
            <select value={moveDest} onChange={(e) => setMoveDest(e.target.value)} className="input mb-4">
              <option value="">(root)</option>
              {data.folders.filter(Boolean).map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setMoveFile(null)} className="btn-ghost">Cancel</button>
              <button onClick={doMove} className="btn-primary">Move</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
