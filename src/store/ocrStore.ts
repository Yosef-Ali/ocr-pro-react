// Zustand store for OCR application state
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { OCRFile, OCRResult, Settings, ProcessingStatus, Project, ProjectSummary } from '@/types';

interface OCRState {
  // Projects
  projects: Project[];
  currentProjectId: string | null;
  projectSummaries: Record<string, ProjectSummary | undefined>;

  // Files
  files: OCRFile[];
  currentFileIndex: number;

  // Processing
  isProcessing: boolean;
  processingStatus: ProcessingStatus;
  progress: number;

  // Results
  results: OCRResult[];
  currentResult: OCRResult | null;

  // UI State
  isSettingsOpen: boolean;
  isHelpOpen: boolean;
  activeTab: 'extracted' | 'layout' | 'analysis';

  // Settings
  settings: Settings;

  // Actions
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  setCurrentFileIndex: (index: number) => void;

  startProcessing: () => void;
  updateProgress: (progress: number, status: ProcessingStatus) => void;
  completeProcessing: (results: OCRResult[]) => void;
  updateResult: (fileId: string, patch: Partial<OCRResult>) => void;
  deleteResult: (fileId: string) => void;

  setActiveTab: (tab: 'extracted' | 'layout' | 'analysis') => void;
  toggleSettings: () => void;
  toggleHelp: () => void;
  updateSettings: (settings: Partial<Settings>) => void;

  // Project actions
  createProject: (name: string, description?: string) => string;
  selectProject: (projectId: string | null) => void;
  assignFilesToProject: (fileIds: string[], projectId: string | null) => void;
  setProjectSummary: (summary: ProjectSummary) => void;
}

export const useOCRStore = create<OCRState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        projects: [],
        currentProjectId: null,
        projectSummaries: {},
        files: [],
        currentFileIndex: 0,
        isProcessing: false,
        processingStatus: 'idle',
        progress: 0,
        results: [],
        currentResult: null,
        isSettingsOpen: false,
        isHelpOpen: false,
        activeTab: 'extracted',
        settings: {
          apiKey: '',
          model: 'gemini-1.5-flash',
          maxTokens: 2048,
          language: 'auto',
          preserveLayout: true,
          detectTables: true,
          enhanceImage: false,
          lowTemperature: true,
          forceAmharic: false,
          strictAmharic: false,
          openRouterApiKey: '',
          openRouterModel: '',
          fallbackToOpenRouter: false,
          preferOpenRouterForProofreading: false,
          pdfIncludeTOC: true,
          pdfIncludeFooter: true,
          pdfTocPosition: 'end',
          bookIncludeCover: true,
        },

        // File actions
        addFiles: (newFiles) => {
          // Create data URLs so we can persist and re-run OCR after reloads
          (async () => {
            const toDataUrl = (f: File) => new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(f);
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
            });
            const enriched: OCRFile[] = [];
            for (let index = 0; index < newFiles.length; index++) {
              const file = newFiles[index];
              let dataUrl = '';
              try { dataUrl = await toDataUrl(file); } catch { }
              enriched.push({
                id: `${Date.now()}-${index}`,
                file,
                name: file.name,
                size: file.size,
                type: file.type,
                status: 'pending',
                preview: dataUrl || null,
                projectId: useOCRStore.getState().currentProjectId ?? undefined,
              });
            }
            set((state) => ({ files: [...state.files, ...enriched] }));
          })();
        },

        removeFile: (index) => {
          set((state) => ({
            files: state.files.filter((_, i) => i !== index),
          }));
        },

        clearFiles: () => {
          set({ files: [], results: [], currentResult: null });
        },

        setCurrentFileIndex: (index) => {
          set((state) => {
            const file = state.files[index];
            const nextResult = file ? state.results.find(r => r.fileId === file.id) || null : null;
            return { currentFileIndex: index, currentResult: nextResult };
          });
        },

        // Processing actions
        startProcessing: () => {
          set({
            isProcessing: true,
            processingStatus: 'preparing',
            progress: 0,
          });
        },

        updateProgress: (progress, status) => {
          set({ progress, processingStatus: status });
        },

        completeProcessing: (results) => {
          set((state) => {
            const currentFile = state.files[state.currentFileIndex];
            const enriched = results.map(r => ({ ...r, projectId: state.currentProjectId ?? undefined }));
            const currentResult = currentFile
              ? enriched.find(r => r.fileId === currentFile.id) || enriched[0] || null
              : enriched[0] || null;

            return {
              results: enriched,
              currentResult,
              isProcessing: false,
              processingStatus: 'completed',
              progress: 100,
            };
          });
        },

        updateResult: (fileId, patch) => {
          set((state) => {
            const results = state.results.map(r => r.fileId === fileId ? { ...r, ...patch, metadata: { ...r.metadata, ...patch.metadata } } : r);
            const currentResult = state.currentResult && state.currentResult.fileId === fileId
              ? results.find(r => r.fileId === fileId) || null
              : state.currentResult;
            return { results, currentResult };
          });
        },

        deleteResult: (fileId) => {
          set((state) => {
            const results = state.results.filter(r => r.fileId !== fileId);
            const files = state.files.filter(f => f.id !== fileId);
            let currentFileIndex = state.currentFileIndex;
            if (files.length === 0) currentFileIndex = 0;
            else if (currentFileIndex >= files.length) currentFileIndex = files.length - 1;
            const currentFile = files[currentFileIndex];
            const currentResult = currentFile ? results.find(r => r.fileId === currentFile.id) || null : null;
            return { results, files, currentFileIndex, currentResult };
          });
        },

        // UI actions
        setActiveTab: (tab) => {
          set({ activeTab: tab });
        },

        toggleSettings: () => {
          set((state) => ({ isSettingsOpen: !state.isSettingsOpen }));
        },

        toggleHelp: () => {
          set((state) => ({ isHelpOpen: !state.isHelpOpen }));
        },

        updateSettings: (newSettings) => {
          set((state) => ({
            settings: { ...state.settings, ...newSettings },
          }));
        },

        // Project actions
        createProject: (name, description) => {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const project: Project = { id, name, description, createdAt: Date.now() };
          set((state) => ({ projects: [...state.projects, project], currentProjectId: id }));
          return id;
        },

        selectProject: (projectId) => {
          set({ currentProjectId: projectId });
        },

        assignFilesToProject: (fileIds, projectId) => {
          set((state) => ({
            files: state.files.map(f => fileIds.includes(f.id) ? { ...f, projectId: projectId ?? undefined } : f),
            results: state.results.map(r => fileIds.includes(r.fileId) ? { ...r, projectId: projectId ?? undefined } : r),
          }));
        },

        setProjectSummary: (summary) => {
          set((state) => ({
            projectSummaries: { ...state.projectSummaries, [summary.projectId]: summary },
          }));
        },
      }),
      {
        name: 'ocr-storage',
        partialize: (state) => ({
          projects: state.projects,
          currentProjectId: state.currentProjectId,
          projectSummaries: state.projectSummaries,
          // Exclude API keys from persistence for security
          settings: {
            ...state.settings,
            apiKey: '', // Don't persist API key
            openRouterApiKey: '', // Don't persist OpenRouter API key
          },
          // Persist files without the non-serializable File object
          files: state.files.map(f => ({
            id: f.id,
            file: undefined as any, // stripped on purpose
            name: f.name,
            size: f.size,
            type: f.type,
            status: f.status,
            preview: f.preview || null,
            projectId: f.projectId,
          })),
          results: state.results,
          currentFileIndex: state.currentFileIndex,
        }),
      }
    )
  )
);
