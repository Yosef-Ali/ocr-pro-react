import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOCRStore } from '@/store/ocrStore';
import { useExport } from '@/hooks/useExport';
import { MoreHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchResultsPaged as apiFetchResults } from '@/services/api/results';
import { fetchFiles as apiFetchFiles } from '@/services/api/files';
import { mapRemoteResult } from '@/services/api/transformers';
//

export const OCRTableTab: React.FC = () => {
    const { results, files, deleteResult, setCurrentFileIndex, currentProjectId, assignFilesToProject } = useOCRStore();
    const { exportResult, exportMany } = useExport();
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    // Remote fetching by project (Cloudflare D1)
    const [remoteResults, setRemoteResults] = useState<ReturnType<typeof mapRemoteResult>[]>([]);
    const [remoteFilesMap, setRemoteFilesMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const pageSize = 25;
    const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'confidence'>('created_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [query, setQuery] = useState('');

    useEffect(() => {
        setPage(0);
    }, [currentProjectId, query]);

    useEffect(() => {
        let canceled = false;
        (async () => {
            try {
                setLoading(true);
                // If a project is selected, fetch that project's results/files from D1
                if (currentProjectId) {
                    const [{ results: rr, total }, rf] = await Promise.all([
                        apiFetchResults({ projectId: currentProjectId }, { limit: pageSize, offset: page * pageSize, sortBy, sortDir }),
                        apiFetchFiles(currentProjectId)
                    ]);
                    if (canceled) return;
                    setRemoteResults(rr.map(mapRemoteResult));
                    const map: Record<string, string> = {};
                    rf.forEach(f => { map[f.id] = f.name; });
                    setRemoteFilesMap(map);
                    setTotal(total);
                } else {
                    // No project selected — show local state fallback
                    setRemoteResults([]);
                    setRemoteFilesMap({});
                    setTotal(0);
                }
            } catch (err) {
                console.warn('Failed to fetch results from D1; using local state', err);
                if (!canceled) {
                    setRemoteResults([]);
                    setRemoteFilesMap({});
                    setTotal(0);
                }
            } finally {
                if (!canceled) setLoading(false);
            }
        })();
        return () => { canceled = true; };
    }, [currentProjectId, page, sortBy, sortDir]);

    const getFileName = useCallback((fileId: string) => remoteFilesMap[fileId] || files.find(f => f.id === fileId)?.name || 'Unknown', [remoteFilesMap, files]);

    // Use remote results for the current project when available; otherwise fallback to local filtered results
    const baseResults = useMemo(() => {
        if (currentProjectId && remoteResults.length >= 0) return remoteResults;
        return currentProjectId ? results.filter(r => r.projectId === currentProjectId) : results;
    }, [results, currentProjectId, remoteResults]);
    const filteredResults = useMemo(() => {
        if (!query.trim()) return baseResults;
        const q = query.toLowerCase();
        return baseResults.filter(r =>
            getFileName(r.fileId).toLowerCase().includes(q) ||
            (r.documentType || '').toLowerCase().includes(q) ||
            (r.detectedLanguage || '').toLowerCase().includes(q)
        );
    }, [baseResults, query]);
    const allSelected = useMemo(() => filteredResults.length > 0 && filteredResults.every(r => selected[r.fileId]), [filteredResults, selected]);
    const selectedResults = useMemo(() => filteredResults.filter(r => selected[r.fileId]), [filteredResults, selected]);
    const countSelected = selectedResults.length;

    if (!loading && filteredResults.length === 0) {
        return <p className="text-sm text-muted-foreground">No OCR results yet.</p>;
    }

    const handleExportXlsx = async () => {
        try {
            const [{ utils, writeFile }, { saveAs }] = await Promise.all([
                import('xlsx').then((m: any) => ({ utils: m.utils, writeFile: m.writeFile || m.writeFileXLSX })),
                import('file-saver')
            ]);
            const header = ['File', 'Language', 'Type', 'Confidence (%)', 'Words'];
            const rows = selectedResults.map(r => [
                getFileName(r.fileId),
                r.detectedLanguage || '',
                r.documentType || '',
                Number((r.confidence * 100).toFixed(1)),
                r.metadata?.wordCount ?? ''
            ]);
            const aoa = [header, ...rows];
            const ws = utils.aoa_to_sheet(aoa);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, 'OCR Results');
            // Prefer writeFile if available (saves directly). Fallback to Blob + saveAs.
            if (typeof writeFile === 'function') {
                await writeFile(wb, `ocr-results-${Date.now()}.xlsx`);
            } else {
                const xlsx = await import('xlsx');
                const wbout = xlsx.write(wb as any, { bookType: 'xlsx', type: 'array' } as any);
                const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                saveAs(blob, `ocr-results-${Date.now()}.xlsx`);
            }
            toast.success('Exported XLSX');
        } catch (err) {
            console.error('XLSX export error', err);
            toast.error('Failed to export XLSX');
        }
    };

    const handleCopyMarkdownTable = async () => {
        const escapePipes = (s: string) => s?.replace(/\|/g, '\\|') || '';
        const header = ['File', 'Language', 'Type', 'Confidence', 'Words'];
        const sep = header.map(() => '---');
        const lines = [
            `| ${header.join(' | ')} |`,
            `| ${sep.join(' | ')} |`,
            ...selectedResults.map(r => `| ${[
                escapePipes(getFileName(r.fileId)),
                escapePipes(r.detectedLanguage || ''),
                escapePipes(r.documentType || ''),
                `${(r.confidence * 100).toFixed(1)}%`,
                (r.metadata?.wordCount ?? '').toString(),
            ].join(' | ')} |`),
        ];
        await navigator.clipboard.writeText(lines.join('\n'));
        toast.success('Markdown table copied');
    };

    const handleExportBookDocxSelection = async () => {
        try {
            if (selectedResults.length === 0) return;
            const { Document, Packer, Paragraph, HeadingLevel, TableOfContents } = await import('docx' as any);
            const sections: any[] = [];
            const main: any[] = [];
            const { useOCRStore } = await import('@/store/ocrStore');
            const { settings } = useOCRStore.getState();
            if (settings.bookIncludeCover) {
                sections.push({
                    children: [
                        new Paragraph({ text: 'OCR Selection — Book', heading: HeadingLevel.HEADING_1 }),
                        new Paragraph({ text: `Generated: ${new Date().toLocaleString()}` }),
                    ]
                });
            } else {
                main.push(new Paragraph({ text: 'OCR Selection — Book', heading: HeadingLevel.HEADING_1 }));
            }
            if (settings.pdfIncludeTOC && (settings.pdfTocPosition || 'end') === 'start') {
                main.push(new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_2 }));
                main.push(new (TableOfContents as any)('Table of Contents', { hyperlink: true, headingStyleRange: '1-5' }));
            }
            for (let i = 0; i < selectedResults.length; i++) {
                const r = selectedResults[i];
                const title = `${i + 1}. ${getFileName(r.fileId)} (${r.documentType || 'Document'})`;
                main.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }));
                const content = (r.layoutPreserved || r.extractedText || '').split('\n');
                for (const line of content) main.push(new Paragraph(line));
            }
            if (settings.pdfIncludeTOC && (settings.pdfTocPosition || 'end') === 'end') {
                main.push(new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_2 }));
                main.push(new (TableOfContents as any)('Table of Contents', { hyperlink: true, headingStyleRange: '1-5' }));
            }
            sections.push({ children: main });
            const doc = new Document({ sections });
            const blob = await Packer.toBlob(doc);
            const { saveAs } = await import('file-saver');
            saveAs(blob, `ocr-selection-book-${Date.now()}.docx`);
            toast.success('Book DOCX exported');
        } catch (err) {
            console.error('Selection Book DOCX error', err);
            toast.error('Failed to export Book DOCX');
        }
    };

    const handleExportBookPdfSelection = async () => {
        try {
            if (selectedResults.length === 0) return;
            const [{ jsPDF }] = await Promise.all([import('jspdf')]);
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            doc.setFont('helvetica', 'normal');
            const { needsEthiopicFont, ensureEthiopicFont } = await import('@/utils/pdfFonts');
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 40;
            const maxWidth = pageWidth - margin * 2;
            let y = margin;
            let currentPage = 1;
            const toc: Array<{ title: string; page: number }> = [];
            const addText = async (text: string, size = 12, bold = false) => {
                if (needsEthiopicFont(text)) {
                    await ensureEthiopicFont(doc);
                    doc.setFont('NotoSansEthiopic', bold ? 'bold' : 'normal');
                } else {
                    doc.setFont('helvetica', bold ? 'bold' : 'normal');
                }
                doc.setFontSize(size);
                const lines = doc.splitTextToSize(text, maxWidth) as string[];
                for (const line of lines) {
                    if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; currentPage += 1; }
                    doc.text(line, margin, y);
                    y += size + 4;
                }
            };
            // Read settings via store to optionally include TOC/footer and cover
            const { useOCRStore } = await import('@/store/ocrStore');
            const { settings } = useOCRStore.getState();
            if (settings.bookIncludeCover) {
                await addText('OCR Selection — Book', 22, true); y += 16;
                await addText(`Generated: ${new Date().toLocaleString()}`, 12, false);
                doc.addPage(); y = margin; currentPage += 1;
            } else {
                await addText('OCR Selection — Book', 18, true); y += 8;
            }
            for (let i = 0; i < selectedResults.length; i++) {
                const r = selectedResults[i];
                const title = `${i + 1}. ${getFileName(r.fileId)} (${r.documentType || 'Document'})`;
                toc.push({ title, page: currentPage });
                await addText(title, 14, true);
                await addText((r.layoutPreserved || r.extractedText || ''), 12, false);
                y += 6;
            }
            if (settings.pdfIncludeTOC) {
                if (y > doc.internal.pageSize.getHeight() - margin - 40) { doc.addPage(); y = margin; currentPage += 1; }
                await addText('Table of Contents', 16, true);
                for (const item of toc) { await addText(`${item.title} ..... ${item.page}`, 12, false); }
            }
            if (settings.pdfIncludeFooter) {
                const pageCount = doc.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    const pageHeight = doc.internal.pageSize.getHeight();
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - margin / 2, { align: 'center' } as any);
                }
            }
            const blob = doc.output('blob');
            const { saveAs } = await import('file-saver');
            saveAs(blob, `ocr-selection-book-${Date.now()}.pdf`);
            toast.success('Book PDF exported');
        } catch (err) {
            console.error('Selection Book PDF error', err);
            toast.error('Failed to export Book PDF');
        }
    };

    const handleAssignToCurrent = () => {
        if (!currentProjectId) {
            toast.error('Select a project in the header first');
            return;
        }
        const ids = selectedResults.map(r => r.fileId);
        if (ids.length === 0) return;
        assignFilesToProject(ids, currentProjectId);
        toast.success('Assigned to current project');
    };

    const handleClearProject = () => {
        const ids = selectedResults.map(r => r.fileId);
        if (ids.length === 0) return;
        assignFilesToProject(ids, null);
        toast.success('Cleared project assignment');
    };

    return (
        <div className="overflow-x-auto overflow-y-visible">
            <div className="flex items-center justify-between mb-3 gap-3">
                <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                        {countSelected > 0 ? `${countSelected} selected` : loading ? 'Fetching…' : `${filteredResults.length}${currentProjectId ? ` of ${total}` : ''} items`}
                    </div>
                    {currentProjectId && (
                        <div className="flex items-center gap-2 text-xs">
                            <button className="px-2 py-1 rounded border border-border bg-background disabled:opacity-50 hover:bg-accent" disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))}>Prev</button>
                            <span>Page {page + 1}</span>
                            <button className="px-2 py-1 rounded border border-border bg-background disabled:opacity-50 hover:bg-accent" disabled={loading || ((page + 1) * pageSize >= total)} onClick={() => setPage(p => p + 1)}>Next</button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="px-2 py-1 text-sm border rounded" />
                </div>
                <BulkActions
                    disabled={countSelected === 0}
                    onTxt={() => exportMany(filteredResults.filter(r => selected[r.fileId]), { format: 'txt', includeMetadata: true, includeAnalysis: false, preserveFormatting: true })}
                    onPdf={() => exportMany(filteredResults.filter(r => selected[r.fileId]), { format: 'pdf' as any, includeMetadata: true, includeAnalysis: false, preserveFormatting: true })}
                    onCsv={() => exportMany(filteredResults.filter(r => selected[r.fileId]), { format: 'csv' as any, includeMetadata: true, includeAnalysis: false, preserveFormatting: true })}
                    onDocx={() => exportMany(filteredResults.filter(r => selected[r.fileId]), { format: 'docx' as any, includeMetadata: true, includeAnalysis: false, preserveFormatting: true })}
                    onCopyCsv={() => {
                        const header = ['language', 'confidence', 'documentType', 'wordCount', 'characterCount'];
                        const lines = [header.join(',')];
                        results.filter(r => selected[r.fileId]).forEach(r => {
                            lines.push([
                                JSON.stringify(r.detectedLanguage || ''),
                                (r.confidence ?? 0).toString(),
                                JSON.stringify(r.documentType || ''),
                                (r.metadata?.wordCount ?? '').toString(),
                                (r.metadata?.characterCount ?? '').toString(),
                            ].join(','));
                        });
                        navigator.clipboard.writeText(lines.join('\n'));
                        toast.success('CSV copied to clipboard');
                    }}
                    onXlsx={handleExportXlsx}
                    onCopyMd={handleCopyMarkdownTable}
                    onBookDocx={handleExportBookDocxSelection}
                    onBookPdf={handleExportBookPdfSelection}
                    onAssignCurrent={handleAssignToCurrent}
                    onClearProject={handleClearProject}
                />
            </div>

            <table className="min-w-full text-sm">
                <thead>
                    <tr className="text-left border-b">
                        <th className="py-2 pr-4 w-8">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    const next: Record<string, boolean> = {};
                                    filteredResults.forEach(r => { next[r.fileId] = checked; });
                                    setSelected(next);
                                }}
                            />
                        </th>
                        <th className="py-2 pr-4">File</th>
                        <th className="py-2 pr-4">Language</th>
                        <th className="py-2 pr-4">Type</th>
                        <th className="py-2 pr-4">
                            <button className="inline-flex items-center gap-1 hover:underline" onClick={() => {
                                const nextDir = sortBy === 'confidence' ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
                                setSortBy('confidence');
                                setSortDir(nextDir);
                                setPage(0);
                            }}>Confidence{sortBy === 'confidence' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</button>
                        </th>
                        <th className="py-2 pr-4">Words</th>
                        <th className="py-2 pr-4">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredResults.map((r) => (
                        <tr key={r.id} className="border-b border-border hover:bg-accent">
                            <td className="py-2 pr-4">
                                <input
                                    type="checkbox"
                                    checked={!!selected[r.fileId]}
                                    onChange={(e) => setSelected(prev => ({ ...prev, [r.fileId]: e.target.checked }))}
                                />
                            </td>
                            <td className="py-2 pr-4">
                                <button
                                    className="text-primary hover:underline"
                                    onClick={() => {
                                        const idx = files.findIndex(f => f.id === r.fileId);
                                        if (idx >= 0) setCurrentFileIndex(idx);
                                    }}
                                >
                                    {getFileName(r.fileId)}
                                </button>
                            </td>
                            <td className="py-2 pr-4">{r.detectedLanguage}</td>
                            <td className="py-2 pr-4">{r.documentType}</td>
                            <td className="py-2 pr-4">{(r.confidence * 100).toFixed(1)}%</td>
                            <td className="py-2 pr-4">{r.metadata?.wordCount?.toLocaleString() || '-'}</td>
                            <td className="py-2 pr-4">
                                <div className="relative inline-block text-left">
                                    <MenuButton
                                        onExportTxt={() => exportResult(r, { format: 'txt', includeMetadata: true, includeAnalysis: false, preserveFormatting: true })}
                                        onExportPdf={() => exportResult(r, { format: 'pdf' as any, includeMetadata: true, includeAnalysis: false, preserveFormatting: true })}
                                        onAssignCurrent={async () => {
                                            if (!currentProjectId) {
                                                toast.error('Select a project in the header first');
                                                return;
                                            }
                                            await assignFilesToProject([r.fileId], currentProjectId);
                                            toast.success('Assigned to current project');
                                        }}
                                        onClearProject={async () => {
                                            await assignFilesToProject([r.fileId], null);
                                            toast.success('Cleared project assignment');
                                        }}
                                        onDelete={async () => {
                                            if (confirm('Delete this OCR result?')) {
                                                await deleteResult(r.fileId);
                                                toast.success('OCR result deleted');
                                            }
                                        }}
                                    />
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

type MenuHandlers = {
    onExportTxt: () => void;
    onExportPdf: () => void;
    onAssignCurrent: () => void | Promise<void>;
    onClearProject: () => void | Promise<void>;
    onDelete: () => void | Promise<void>;
};

const MenuButton: React.FC<MenuHandlers> = ({ onExportTxt, onExportPdf, onAssignCurrent, onClearProject, onDelete }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);

    useEffect(() => {
        function handleDocClick(e: MouseEvent) {
            if (!open) return;
            const el = ref.current;
            if (el && e.target instanceof Node && !el.contains(e.target)) setOpen(false);
        }
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setOpen(false);
                triggerRef.current?.focus();
            }
        }
        document.addEventListener('mousedown', handleDocClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleDocClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    useEffect(() => {
        if (open) {
            // focus first item when opened
            const first = itemsRef.current.find(Boolean);
            first?.focus();
        }
    }, [open]);

    const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!open) return;
        const items = itemsRef.current.filter(Boolean) as HTMLButtonElement[];
        if (items.length === 0) return;
        const currentIndex = items.findIndex((el) => el === (document.activeElement as HTMLElement));
        const focusAt = (idx: number) => items[(idx + items.length) % items.length]?.focus();
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                focusAt(currentIndex >= 0 ? currentIndex + 1 : 0);
                break;
            case 'ArrowUp':
                e.preventDefault();
                focusAt(currentIndex >= 0 ? currentIndex - 1 : items.length - 1);
                break;
            case 'Home':
                e.preventDefault();
                focusAt(0);
                break;
            case 'End':
                e.preventDefault();
                focusAt(items.length - 1);
                break;
            case 'Tab':
                e.preventDefault();
                if (e.shiftKey) focusAt(currentIndex - 1);
                else focusAt(currentIndex + 1);
                break;
            default:
                break;
        }
    };

    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Position the menu relative to the trigger using fixed coordinates
    const computePosition = (menuWidth = 192, menuHeight?: number) => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        let left = rect.right + scrollX - menuWidth; // right aligned
        left = Math.max(8, Math.min(left, (window.innerWidth - menuWidth - 8)));
        let top = rect.bottom + scrollY + 6; // below trigger
        if (menuHeight && top + menuHeight > scrollY + window.innerHeight - 8) {
            top = rect.top + scrollY - (menuHeight + 6); // flip above if not enough space
        }
        setPos({ top, left });
    };

    useEffect(() => {
        if (!open) return;
        // initial guess with known width (w-48 => 192px)
        computePosition(192);
        const handle = () => {
            const h = menuRef.current?.offsetHeight;
            computePosition(192, h);
        };
        // adjust after render and on resize/scroll
        const raf = requestAnimationFrame(handle);
        window.addEventListener('resize', handle);
        window.addEventListener('scroll', handle, true);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', handle);
            window.removeEventListener('scroll', handle, true);
        };
    }, [open]);

    return (
        <div className="relative" ref={ref}>
            <button
                className="p-2 rounded hover:bg-accent"
                onClick={() => setOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                ref={triggerRef}
            >
                <MoreHorizontal className="w-4 h-4" />
            </button>
            {open && pos && createPortal(
                <div
                    ref={menuRef}
                    className="fixed w-48 bg-card text-card-foreground border border-border rounded shadow-xl z-[9999]"
                    style={{ top: pos.top, left: pos.left }}
                    role="menu"
                    onKeyDown={onMenuKeyDown}
                >
                    <button ref={(el) => { itemsRef.current[0] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => { setOpen(false); onExportTxt(); }}>Export TXT</button>
                    <button ref={(el) => { itemsRef.current[1] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => { setOpen(false); onExportPdf(); }}>Export PDF</button>
                    <div className="border-t my-1" />
                    <button ref={(el) => { itemsRef.current[2] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => { setOpen(false); onAssignCurrent(); }}>Assign to Current Project</button>
                    <button ref={(el) => { itemsRef.current[3] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => { setOpen(false); onClearProject(); }}>Clear Project</button>
                    <div className="border-t my-1" />
                    <button ref={(el) => { itemsRef.current[4] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-red-50 text-sm text-red-600" onClick={() => { setOpen(false); onDelete(); }}>Delete</button>
                </div>, document.body)
            }
        </div>
    );
};

const BulkActions: React.FC<{ disabled: boolean; onTxt: () => void; onPdf: () => void; onCsv: () => void; onDocx: () => void; onCopyCsv: () => void; onXlsx: () => void; onCopyMd: () => void; onBookDocx: () => void; onBookPdf: () => void; onAssignCurrent: () => void; onClearProject: () => void; }> = ({ disabled, onTxt, onPdf, onCsv, onDocx, onCopyCsv, onXlsx, onCopyMd, onBookDocx, onBookPdf, onAssignCurrent, onClearProject }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);

    useEffect(() => {
        function handleDocClick(e: MouseEvent) {
            if (!open) return;
            const el = ref.current;
            if (el && e.target instanceof Node && !el.contains(e.target)) setOpen(false);
        }
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setOpen(false);
                triggerRef.current?.focus();
            }
        }
        document.addEventListener('mousedown', handleDocClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleDocClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    useEffect(() => {
        if (open) {
            const first = itemsRef.current.find(Boolean);
            first?.focus();
        }
    }, [open]);

    const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!open) return;
        const items = itemsRef.current.filter(Boolean) as HTMLButtonElement[];
        if (items.length === 0) return;
        const currentIndex = items.findIndex((el) => el === (document.activeElement as HTMLElement));
        const focusAt = (idx: number) => items[(idx + items.length) % items.length]?.focus();
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                focusAt(currentIndex >= 0 ? currentIndex + 1 : 0);
                break;
            case 'ArrowUp':
                e.preventDefault();
                focusAt(currentIndex >= 0 ? currentIndex - 1 : items.length - 1);
                break;
            case 'Home':
                e.preventDefault();
                focusAt(0);
                break;
            case 'End':
                e.preventDefault();
                focusAt(items.length - 1);
                break;
            case 'Tab':
                e.preventDefault();
                if (e.shiftKey) focusAt(currentIndex - 1);
                else focusAt(currentIndex + 1);
                break;
            default:
                break;
        }
    };

    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const computePosition = (menuWidth = 256, menuHeight?: number) => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        let left = rect.right + scrollX - menuWidth;
        left = Math.max(8, Math.min(left, (window.innerWidth - menuWidth - 8)));
        let top = rect.bottom + scrollY + 6;
        if (menuHeight && top + menuHeight > scrollY + window.innerHeight - 8) {
            top = rect.top + scrollY - (menuHeight + 6);
        }
        setPos({ top, left });
    };

    useEffect(() => {
        if (!open) return;
        computePosition(256);
        const handle = () => {
            const h = menuRef.current?.offsetHeight;
            computePosition(256, h);
        };
        const raf = requestAnimationFrame(handle);
        window.addEventListener('resize', handle);
        window.addEventListener('scroll', handle, true);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', handle);
            window.removeEventListener('scroll', handle, true);
        };
    }, [open]);

    return (
        <div className="relative inline-block text-left" ref={ref}>
            <button disabled={disabled} onClick={() => setOpen(o => !o)} className="px-3 py-1.5 rounded bg-muted hover:bg-accent disabled:opacity-50" aria-haspopup="menu" aria-expanded={open} ref={triggerRef}>Bulk Actions</button>
            {open && pos && createPortal(
                <div ref={menuRef} className="fixed w-64 bg-card text-card-foreground border border-border rounded shadow-xl z-[9999]" style={{ top: pos.top, left: pos.left }} role="menu" onKeyDown={onMenuKeyDown}>
                    <button ref={(el) => { itemsRef.current[0] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => { setOpen(false); onTxt(); }}>Export TXT (ZIP)</button>
                    <button ref={(el) => { itemsRef.current[1] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => { setOpen(false); onPdf(); }}>Export PDF (ZIP)</button>
                    <button ref={(el) => { itemsRef.current[2] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => { setOpen(false); onDocx(); }}>Export DOCX (ZIP)</button>
                    <button ref={(el) => { itemsRef.current[3] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => { setOpen(false); onXlsx(); }}>Export XLSX</button>
                    <button ref={(el) => { itemsRef.current[4] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => { setOpen(false); onCsv(); }}>Export CSV</button>
                    <button ref={(el) => { itemsRef.current[5] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => { setOpen(false); onCopyCsv(); }}>Copy CSV</button>
                    <button ref={(el) => { itemsRef.current[6] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => { setOpen(false); onCopyMd(); }}>Copy Markdown Table</button>
                    <div className="border-t my-1" />
                    <button ref={(el) => { itemsRef.current[7] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => { setOpen(false); onBookDocx(); }}>Book DOCX (Selection)</button>
                    <button ref={(el) => { itemsRef.current[8] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-accent text-sm" onClick={() => { setOpen(false); onBookPdf(); }}>Book PDF (Selection)</button>
                    <div className="border-t my-1" />
                    <button ref={(el) => { itemsRef.current[9] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm" onClick={() => { setOpen(false); onAssignCurrent(); }}>Assign to Current Project</button>
                    <button ref={(el) => { itemsRef.current[10] = el; }} role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-red-50 text-sm text-red-600" onClick={() => { setOpen(false); onClearProject(); }}>Clear Project</button>
                </div>, document.body)
            }
        </div>
    );
};
