import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutAnalysis, OCRFile, OCRResult } from '@/types';
import { useOCRStore } from './ocrStore';

const { deleteFileMock, deleteResultMock } = vi.hoisted(() => ({
  deleteFileMock: vi.fn<(fileId: string) => Promise<void>>(),
  deleteResultMock: vi.fn<(resultId: string) => Promise<void>>(),
}));

vi.mock('@/services/api/files', () => ({
  fetchFiles: vi.fn(),
  upsertFiles: vi.fn(),
  deleteFile: deleteFileMock,
}));

vi.mock('@/services/api/results', () => ({
  fetchResults: vi.fn(),
  upsertResults: vi.fn(),
  deleteResult: deleteResultMock,
}));

const createFile = (id: string, name: string): OCRFile => ({
  id,
  name,
  size: 1024,
  type: 'application/pdf',
  status: 'completed',
  preview: null,
});

const createLayoutAnalysis = (): LayoutAnalysis => ({
  textBlocks: 1,
  tables: 0,
  images: 0,
  columns: 1,
  complexity: 'low',
  structure: [],
});

const createResult = (id: string, fileId: string): OCRResult => ({
  id,
  fileId,
  extractedText: `${id}-text`,
  layoutPreserved: `${id}-layout`,
  detectedLanguage: 'en',
  confidence: 0.95,
  documentType: 'pdf',
  processingTime: 100,
  layoutAnalysis: createLayoutAnalysis(),
});

describe('useOCRStore.removeFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteFileMock.mockResolvedValue(undefined);
    deleteResultMock.mockResolvedValue(undefined);
    useOCRStore.setState({
      files: [],
      results: [],
      currentFileIndex: 0,
      currentResult: null,
    });
  });

  it('removes the current file and associated result while updating selection', async () => {
    const files = [createFile('file-1', 'One'), createFile('file-2', 'Two'), createFile('file-3', 'Three')];
    const results = [
      createResult('result-1', 'file-1'),
      createResult('result-2', 'file-2'),
      createResult('result-3', 'file-3'),
    ];

    useOCRStore.setState({
      files,
      results,
      currentFileIndex: 1,
      currentResult: results[1],
    });

    await useOCRStore.getState().removeFile(1);

    const state = useOCRStore.getState();
    expect(state.files.map((file) => file.id)).toEqual(['file-1', 'file-3']);
    expect(state.results.map((result) => result.id)).toEqual(['result-1', 'result-3']);
    expect(state.currentFileIndex).toBe(1);
    expect(state.currentResult?.id).toBe('result-3');

    expect(deleteFileMock).toHaveBeenCalledTimes(1);
    expect(deleteFileMock).toHaveBeenCalledWith('file-2');
    expect(deleteResultMock).toHaveBeenCalledTimes(1);
    expect(deleteResultMock).toHaveBeenCalledWith('result-2');
  });

  it('reindexes when removing earlier entries and clears state when empty', async () => {
    const files = [createFile('file-1', 'One'), createFile('file-2', 'Two'), createFile('file-3', 'Three')];
    const results = [
      createResult('result-1', 'file-1'),
      createResult('result-2', 'file-2'),
      createResult('result-3', 'file-3'),
    ];

    useOCRStore.setState({
      files,
      results,
      currentFileIndex: 2,
      currentResult: results[2],
    });

    const { removeFile } = useOCRStore.getState();

    await removeFile(0);
    let state = useOCRStore.getState();
    expect(state.files.map((file) => file.id)).toEqual(['file-2', 'file-3']);
    expect(state.results.map((result) => result.id)).toEqual(['result-2', 'result-3']);
    expect(state.currentFileIndex).toBe(1);
    expect(state.currentResult?.id).toBe('result-3');

    await removeFile(1);
    state = useOCRStore.getState();
    expect(state.files.map((file) => file.id)).toEqual(['file-2']);
    expect(state.results.map((result) => result.id)).toEqual(['result-2']);
    expect(state.currentFileIndex).toBe(0);
    expect(state.currentResult?.id).toBe('result-2');

    await removeFile(0);
    state = useOCRStore.getState();
    expect(state.files).toHaveLength(0);
    expect(state.results).toHaveLength(0);
    expect(state.currentFileIndex).toBe(0);
    expect(state.currentResult).toBeNull();

    expect(deleteFileMock).toHaveBeenCalledTimes(3);
    expect(deleteFileMock.mock.calls.map(([id]) => id)).toEqual(['file-1', 'file-3', 'file-2']);
    expect(deleteResultMock).toHaveBeenCalledTimes(3);
    expect(deleteResultMock.mock.calls.map(([id]) => id)).toEqual(['result-1', 'result-3', 'result-2']);
  });

  it('skips deleting results for files without matches', async () => {
    const files = [createFile('file-1', 'One'), createFile('file-2', 'Two')];
    const results = [createResult('result-1', 'file-1')];

    useOCRStore.setState({
      files,
      results,
      currentFileIndex: 0,
      currentResult: results[0],
    });

    await useOCRStore.getState().removeFile(1);

    const state = useOCRStore.getState();
    expect(state.files.map((file) => file.id)).toEqual(['file-1']);
    expect(state.results.map((result) => result.id)).toEqual(['result-1']);
    expect(state.currentFileIndex).toBe(0);
    expect(state.currentResult?.id).toBe('result-1');

    expect(deleteFileMock).toHaveBeenCalledTimes(1);
    expect(deleteFileMock).toHaveBeenCalledWith('file-2');
    expect(deleteResultMock).not.toHaveBeenCalled();
  });
});
