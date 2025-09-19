// Zustand store for OCR application state
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { OCRFile, OCRResult, Settings, ProcessingStatus, Project, ProjectSummary, User } from '@/types';
import {
  fetchProjects,
  createProject as apiCreateProject,
  fetchProjectSummary,
  saveProjectSummary as apiSaveProjectSummary,
  deleteProjectSummary as apiDeleteProjectSummary,
  deleteProject as apiDeleteProject,
} from '@/services/api/projects';
import { fetchFiles, upsertFiles as apiUpsertFiles, deleteFile as apiDeleteFile } from '@/services/api/files';
import { fetchResults, upsertResults as apiUpsertResults, deleteResult as apiDeleteResult } from '@/services/api/results';
import { mapRemoteFile, mapRemoteResult, mapRemoteSummary } from '@/services/api/transformers';

export const LAST_PROJECT_STORAGE_KEY = 'ocr:lastProjectId';

interface OCRState {
  // User state
  currentUser: User | null;

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

  // Remote state
  isRemoteHydrated: boolean;
  hydrateError?: string;

  // UI State
  isSettingsOpen: boolean;
  isHelpOpen: boolean;
  activeTab: 'extracted' | 'layout' | 'analysis';

  // Settings
  settings: Settings;

  // Actions
  setCurrentUser: (user: User | null) => void;
  addFiles: (files: File[]) => Promise<string[]>;
  removeFile: (index: number) => Promise<void>;
  clearFiles: () => Promise<void>;
  setCurrentFileIndex: (index: number) => void;

  startProcessing: () => void;
  updateProgress: (progress: number, status: ProcessingStatus) => void;
  completeProcessing: (results: OCRResult[]) => Promise<void>;
  updateResult: (fileId: string, patch: Partial<OCRResult>) => void;
  deleteResult: (fileId: string) => Promise<void>;

  setActiveTab: (tab: 'extracted' | 'layout' | 'analysis') => void;
  toggleSettings: () => void;
  toggleHelp: () => void;
  updateSettings: (settings: Partial<Settings>) => void;

  // Project actions
  createProject: (name: string, description?: string) => Promise<string>;
  selectProject: (projectId: string | null) => Promise<void>;
  assignFilesToProject: (fileIds: string[], projectId: string | null) => Promise<void>;
  setProjectSummary: (summary: ProjectSummary) => Promise<void>;
  clearProjectSummary: (projectId: string) => Promise<void>;
  clearAllSummaries: () => Promise<void>;
  resetAllData: () => Promise<void>;
  syncAllResults: () => void;
  ensureOriginalSnapshots: () => void;

  hydrateFromRemote: () => Promise<void>;
}

export const useOCRStore = create<OCRState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        currentUser: null,
        projects: [],
        currentProjectId: (typeof window !== 'undefined' ? localStorage.getItem(LAST_PROJECT_STORAGE_KEY) : null) || null,
        projectSummaries: {},
        files: [],
        currentFileIndex: 0,
        isProcessing: false,
        processingStatus: 'idle',
        progress: 0,
        results: [],
        currentResult: null,
        isRemoteHydrated: false,
        hydrateError: undefined,
        isSettingsOpen: false,
        isHelpOpen: false,
        activeTab: 'extracted',
        settings: {
          apiKey: '',
          model: 'gemini-2.5-pro',
          fallbackModel: 'gemini-1.5-flash',
          visionModel: 'gemini-2.5-pro',
          maxTokens: 2048,
          language: 'auto',
          ocrEngine: 'auto', // Default to auto mode (Tesseract if no API key, Gemini if API key exists)
          routingMode: 'auto',
          enableLexiconHints: true,
          routerStrategy: 'heuristic',
          edgeLLMEnabled: false,
          edgeLLMProvider: 'webllm',
          edgeLLMModel: 'gemma-3-1b-q4',
          edgeLLMBaseUrl: '',
          edgeLLMEndpoint: 'http://localhost:11434',
          preserveLayout: true,
          detectTables: true,
          enhanceImage: false,
          stripPageNumbers: true,
          allowBasicLLMGuidance: true,
          tipsMaxTokens: 256,
          endUserMode: true,
          lowTemperature: true,
          forceAmharic: false,
          strictAmharic: false,
          openRouterApiKey: typeof window !== 'undefined' ? localStorage.getItem('openRouterApiKey') || '' : '',
          openRouterModel: typeof window !== 'undefined' ? localStorage.getItem('openRouterModel') || '' : '',
          fallbackToOpenRouter: false,
          preferOpenRouterForProofreading: false,
          pdfIncludeTOC: true,
          pdfIncludeFooter: true,
          pdfTocPosition: 'end',
          bookIncludeCover: true,
          // Enhanced Amharic text handling
          amharicTextSpacing: 1.1, // Slightly increased letter spacing for Amharic
          amharicLineHeight: 1.6,   // Better line height for complex scripts
          preferAmharicFonts: true, // Use Ethiopic-optimized fonts when available
        },

        setCurrentUser: (user) => {
          set({ currentUser: user });

          // Clear all data when user changes/logs out
          if (!user) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem(LAST_PROJECT_STORAGE_KEY);
            }
            set({
              projects: [],
              currentProjectId: null,
              projectSummaries: {},
              files: [],
              currentFileIndex: 0,
              results: [],
              currentResult: null,
              isRemoteHydrated: false,
            });
          }
        },

        hydrateFromRemote: async () => {
          const state = useOCRStore.getState();
          if (!state.currentUser) {
            console.warn('Cannot hydrate without authenticated user');
            set({ isRemoteHydrated: true });
            return;
          }

          try {
            const [remoteProjects, remoteFiles, remoteResults] = await Promise.all([
              fetchProjects(),
              fetchFiles(),
              fetchResults(),
            ]);

            const summaries = await Promise.all(
              remoteProjects.map(async (project) => {
                try {
                  const summary = await fetchProjectSummary(project.id);
                  return summary ? mapRemoteSummary(summary) : undefined;
                } catch (error) {
                  console.warn('Failed to fetch summary for project', project.id, error);
                  return undefined;
                }
              })
            );

            try {
              const globalSummary = await fetchProjectSummary('all');
              if (globalSummary) {
                summaries.push(mapRemoteSummary(globalSummary));
              }
            } catch (error) {
              // No global summary stored yet; ignore
            }

            const projectSummaries: Record<string, ProjectSummary | undefined> = {};
            summaries.forEach((summary) => {
              if (summary) {
                projectSummaries[summary.projectId] = summary;
              }
            });

            const projects: Project[] = remoteProjects.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description ?? undefined,
              userId: p.user_id ?? undefined,
              createdAt: p.created_at,
            }));

            const allFiles = remoteFiles.map((f) => mapRemoteFile(f));
            const allResults = remoteResults.map((r) => mapRemoteResult(r));

            // Claim legacy records (created before auth) by setting user_id
            // This runs in background and does not block UI hydration
            try {
              const legacyProjects = remoteProjects.filter((p: any) => !p.user_id);
              const legacyFiles = remoteFiles.filter((f: any) => !f.user_id);
              const legacyResults = remoteResults.filter((r: any) => !r.user_id);
              await Promise.allSettled([
                // Upsert projects with same ID to attach user
                ...legacyProjects.map((p: any) => apiCreateProject({ id: p.id, name: p.name, description: p.description ?? undefined })),
                legacyFiles.length
                  ? apiUpsertFiles(
                    legacyFiles.map((file: any) => ({
                      id: file.id,
                      name: file.name,
                      project_id: file.project_id ?? null,
                      size: file.size ?? null,
                      mime_type: file.mime_type ?? null,
                      status: file.status ?? null,
                      preview: file.preview ?? null,
                      original_preview: file.original_preview ?? null,
                    }))
                  )
                  : Promise.resolve(),
                legacyResults.length
                  ? apiUpsertResults(null, legacyResults.map((item: any) => ({
                    id: item.id,
                    file_id: item.file_id,
                    project_id: item.project_id ?? null,
                    extracted_text: item.extracted_text ?? null,
                    layout_preserved: item.layout_preserved ?? null,
                    detected_language: item.detected_language ?? null,
                    confidence: item.confidence ?? null,
                    document_type: item.document_type ?? null,
                    metadata: item.metadata ?? null,
                  })))
                  : Promise.resolve(),
              ]);
            } catch (claimErr) {
              console.warn('Failed to adopt legacy records', claimErr);
            }

            const sortedProjects = [...projects].sort((a, b) => b.createdAt - a.createdAt);
            const storedProjectId = typeof window !== 'undefined' ? localStorage.getItem(LAST_PROJECT_STORAGE_KEY) : null;

            set((state) => {
              let nextProjectId = state.currentProjectId;
              const hasExisting = nextProjectId ? sortedProjects.some((p) => p.id === nextProjectId) : false;

              if (!hasExisting) {
                const fallback = storedProjectId && sortedProjects.some((p) => p.id === storedProjectId)
                  ? storedProjectId
                  : sortedProjects[0]?.id ?? null;
                nextProjectId = fallback ?? null;

                if (typeof window !== 'undefined') {
                  if (nextProjectId) {
                    localStorage.setItem(LAST_PROJECT_STORAGE_KEY, nextProjectId);
                  } else {
                    localStorage.removeItem(LAST_PROJECT_STORAGE_KEY);
                  }
                }
              }

              const scopedFiles = nextProjectId ? allFiles.filter((file) => file.projectId === nextProjectId) : allFiles;
              const scopedResults = nextProjectId ? allResults.filter((result) => result.projectId === nextProjectId) : allResults;

              const currentFile = scopedFiles[0] ?? null;
              const currentResult = currentFile
                ? scopedResults.find((r) => r.fileId === currentFile.id) || null
                : scopedResults[0] || null;

              return {
                projects: sortedProjects,
                files: scopedFiles,
                results: scopedResults,
                projectSummaries,
                isRemoteHydrated: true,
                hydrateError: undefined,
                currentResult,
                currentFileIndex: 0,
                currentProjectId: nextProjectId,
              };
            });
          } catch (error: any) {
            const status = typeof error?.status === 'number' ? error.status : undefined;
            if (status === 401 || status === 403) {
              // Expected when the backend requires auth but the user is not signed in yet.
              set({ isRemoteHydrated: true, hydrateError: undefined });
              return;
            }

            console.error('Failed to hydrate remote state', error);
            set({ isRemoteHydrated: true, hydrateError: error?.message || 'Failed to load remote data' });
          }
        },

        // File actions
        addFiles: async (newFiles) => {
          const { ensureNonTiffImage } = await import('@/utils/imageUtils');

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
            try {
              dataUrl = await toDataUrl(file);
            } catch (err) {
              console.warn('Failed to read file for preview', err);
            }

            let normalized = dataUrl;
            try {
              if (dataUrl && dataUrl.startsWith('data:')) {
                const header = dataUrl.slice(0, dataUrl.indexOf(',')).toLowerCase();
                if (/image\/(tiff|x-tiff)/.test(header)) {
                  normalized = await ensureNonTiffImage(dataUrl);
                }
              }
            } catch (err) {
              console.warn('Failed to normalize image for processing', err);
              normalized = dataUrl;
            }

            const state = useOCRStore.getState();
            enriched.push({
              id: `${Date.now()}-${index}`,
              file,
              name: file.name,
              size: file.size,
              type: file.type,
              status: 'pending',
              preview: normalized || dataUrl || null,
              originalPreview: dataUrl || null,
              projectId: state.currentProjectId ?? undefined,
              userId: state.currentUser?.id,
            });
          }

          if (enriched.length > 0) {
            set((state) => ({ files: [...state.files, ...enriched] }));
            try {
              await apiUpsertFiles(
                enriched.map((file) => ({
                  id: file.id,
                  name: file.name,
                  project_id: file.projectId ?? null,
                  user_id: file.userId ?? null,
                  size: file.size,
                  mime_type: file.type,
                  status: file.status,
                  preview: file.preview ?? null,
                  original_preview: file.originalPreview ?? null,
                }))
              );
            } catch (error) {
              console.error('Failed to sync files to remote', error);
            }
          }

          return enriched.map((file) => file.id);
        },

        removeFile: async (index) => {
          let targetFile: OCRFile | undefined;
          let relatedResultIds: string[] = [];

          set((state) => {
            targetFile = state.files[index];
            if (targetFile) {
              relatedResultIds = state.results
                .filter((result) => result.fileId === targetFile!.id)
                .map((result) => result.id);
            }

            return {
              files: state.files.filter((_, i) => i !== index),
            };
          });

          if (!targetFile) {
            return;
          }

          let fileDeleteFailed = false;

          try {
            await apiDeleteFile(targetFile.id);
          } catch (error) {
            fileDeleteFailed = true;
            console.error('Failed to delete remote file', error);
          }

          if (!fileDeleteFailed || relatedResultIds.length === 0) {
            return;
          }

          for (const resultId of relatedResultIds) {
            try {
              await apiDeleteResult(resultId);
            } catch (error) {
              console.error('Failed to delete remote result', error);
            }
          }
        },

        clearFiles: async () => {
          const fileIds = useOCRStore.getState().files.map((f) => f.id);
          set({ files: [], results: [], currentResult: null, currentFileIndex: 0 });
          await Promise.allSettled(fileIds.map((id) => apiDeleteFile(id)));
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

        completeProcessing: async (incomingResults) => {
          let enrichedResults: OCRResult[] = [];
          set((state) => {
            const currentFile = state.files[state.currentFileIndex];
            enrichedResults = incomingResults.map(r => ({
              ...r,
              projectId: r.projectId ?? state.currentProjectId ?? undefined,
              userId: r.userId ?? state.currentUser?.id,
              metadata: {
                ...((r as any).metadata || {}),
                originalOCRText: ((r as any).metadata?.originalOCRText) || r.layoutPreserved || r.extractedText || ''
              }
            }));
            const currentResult = currentFile
              ? enrichedResults.find(result => result.fileId === currentFile.id) || enrichedResults[0] || null
              : enrichedResults[0] || null;

            return {
              results: enrichedResults,
              currentResult,
              isProcessing: false,
              processingStatus: 'completed',
              progress: 100,
            };
          });

          const grouped = new Map<string | null, OCRResult[]>();
          for (const result of enrichedResults) {
            const key = result.projectId ?? null;
            const bucket = grouped.get(key) ?? [];
            bucket.push(result);
            grouped.set(key, bucket);
          }

          await Promise.allSettled(
            Array.from(grouped.entries()).map(([projectId, group]) =>
              apiUpsertResults(projectId, group.map((item) => ({
                id: item.id,
                file_id: item.fileId,
                project_id: item.projectId ?? null,
                extracted_text: item.extractedText,
                layout_preserved: item.layoutPreserved,
                detected_language: item.detectedLanguage,
                confidence: item.confidence,
                document_type: item.documentType,
                metadata: item.metadata ? { ...item.metadata, layoutAnalysis: item.layoutAnalysis } : { layoutAnalysis: item.layoutAnalysis },
              })))
            )
          );
        },

        updateResult: (fileId, patch) => {
          let targetResult: OCRResult | undefined;
          set((state) => {
            const results = state.results.map(r => {
              if (r.fileId !== fileId) return r;
              const next = { ...r, ...patch, metadata: { ...r.metadata, ...patch.metadata } };
              targetResult = next;
              return next;
            });
            const currentResult = state.currentResult && state.currentResult.fileId === fileId
              ? results.find(r => r.fileId === fileId) || null
              : state.currentResult;
            return { results, currentResult };
          });

          if (targetResult) {
            apiUpsertResults(targetResult.projectId ?? null, [{
              id: targetResult.id,
              file_id: targetResult.fileId,
              project_id: targetResult.projectId ?? null,
              extracted_text: targetResult.extractedText,
              layout_preserved: targetResult.layoutPreserved,
              detected_language: targetResult.detectedLanguage,
              confidence: targetResult.confidence,
              document_type: targetResult.documentType,
              metadata: targetResult.metadata ? { ...targetResult.metadata, layoutAnalysis: targetResult.layoutAnalysis } : { layoutAnalysis: targetResult.layoutAnalysis },
            }]).catch((error) => console.error('Failed to sync result update', error));
          }
        },

        deleteResult: async (fileId) => {
          let resultId: string | undefined;
          set((state) => {
            const target = state.results.find((r) => r.fileId === fileId);
            resultId = target?.id;
            const results = state.results.filter(r => r.fileId !== fileId);
            const files = state.files.filter(f => f.id !== fileId);
            let currentFileIndex = state.currentFileIndex;
            if (files.length === 0) currentFileIndex = 0;
            else if (currentFileIndex >= files.length) currentFileIndex = files.length - 1;
            const currentFile = files[currentFileIndex];
            const currentResult = currentFile ? results.find(r => r.fileId === currentFile.id) || null : null;
            return { results, files, currentFileIndex, currentResult };
          });
          if (resultId) {
            try {
              await apiDeleteResult(resultId);
            } catch (error) {
              console.error('Failed to delete remote result', error);
            }
          }
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
          set((state) => {
            const updatedSettings = { ...state.settings, ...newSettings };

            // Persist OpenRouter API key to localStorage
            if (newSettings.openRouterApiKey !== undefined) {
              localStorage.setItem('openRouterApiKey', newSettings.openRouterApiKey);
            }
            if (newSettings.openRouterModel !== undefined) {
              localStorage.setItem('openRouterModel', newSettings.openRouterModel);
            }

            return {
              settings: updatedSettings,
            };
          });
        },

        clearOpenRouterSettings: () => {
          localStorage.removeItem('openRouterApiKey');
          localStorage.removeItem('openRouterModel');
          set((state) => ({
            settings: {
              ...state.settings,
              openRouterApiKey: '',
              openRouterModel: '',
            },
          }));
        },

        // Project actions
        createProject: async (name, description) => {
          const { currentUser } = useOCRStore.getState();
          if (!currentUser) {
            throw new Error('Sign in to create projects');
          }

          const remote = await apiCreateProject({ name, description });
          const project: Project = {
            id: remote.id,
            name: remote.name,
            description: remote.description ?? undefined,
            createdAt: remote.created_at,
          };

          set((state) => ({
            projects: [project, ...state.projects.filter((p) => p.id !== project.id)].sort((a, b) => b.createdAt - a.createdAt),
          }));

          await useOCRStore.getState().selectProject(project.id);
          return project.id;
        },

        selectProject: async (projectId) => {
          const state = useOCRStore.getState();
          if (typeof window !== 'undefined') {
            if (projectId) {
              localStorage.setItem(LAST_PROJECT_STORAGE_KEY, projectId);
            } else {
              localStorage.removeItem(LAST_PROJECT_STORAGE_KEY);
            }
          }

          set({
            currentProjectId: projectId,
            currentFileIndex: 0,
            currentResult: null,
            isProcessing: false,
            processingStatus: 'idle',
            progress: 0,
            files: [],
            results: [],
          });

          if (!state.currentUser) {
            return;
          }

          try {
            const [remoteFiles, remoteResults] = await Promise.all([
              fetchFiles(projectId ?? undefined),
              fetchResults({ projectId: projectId ?? undefined }),
            ]);

            const files = remoteFiles.map((f) => mapRemoteFile(f));
            const results = remoteResults.map((r) => mapRemoteResult(r));

            set(() => {
              const firstFile = files[0];
              const firstResult = firstFile
                ? results.find((result) => result.fileId === firstFile.id) ?? null
                : results[0] ?? null;

              return {
                files,
                results,
                currentFileIndex: 0,
                currentResult: firstResult,
                hydrateError: undefined,
              };
            });
          } catch (error: any) {
            const status = typeof error?.status === 'number' ? error.status : error?.response?.status;
            if (status === 401 || status === 403) {
              console.warn('Skipping remote project load due to missing authentication');
              return;
            }
            console.error('Failed to load project data', error);
            set(() => ({ hydrateError: 'Failed to load project data' }));
          }
        },

        assignFilesToProject: async (fileIds, projectId) => {
          const nextProjectId = projectId ?? null;
          const affectedFiles: OCRFile[] = [];
          const affectedResults: OCRResult[] = [];
          set((state) => {
            const files = state.files.map(f => {
              if (!fileIds.includes(f.id)) return f;
              const updated = { ...f, projectId: nextProjectId ?? undefined };
              affectedFiles.push(updated);
              return updated;
            });
            const results = state.results.map(r => {
              if (!fileIds.includes(r.fileId)) return r;
              const updated = { ...r, projectId: nextProjectId ?? undefined };
              affectedResults.push(updated);
              return updated;
            });
            return { files, results };
          });

          await Promise.allSettled([
            apiUpsertFiles(
              affectedFiles.map((file) => ({
                id: file.id,
                name: file.name,
                project_id: file.projectId ?? null,
                size: file.size,
                mime_type: file.type,
                status: file.status,
                preview: file.preview ?? null,
                original_preview: file.originalPreview ?? null,
              }))
            ),
            apiUpsertResults(nextProjectId, affectedResults.map((result) => ({
              id: result.id,
              file_id: result.fileId,
              project_id: result.projectId ?? null,
              extracted_text: result.extractedText,
              layout_preserved: result.layoutPreserved,
              detected_language: result.detectedLanguage,
              confidence: result.confidence,
              document_type: result.documentType,
              metadata: result.metadata ? { ...result.metadata, layoutAnalysis: result.layoutAnalysis } : { layoutAnalysis: result.layoutAnalysis },
            })))
          ]);
        },

        setProjectSummary: async (summary) => {
          set((state) => ({
            projectSummaries: { ...state.projectSummaries, [summary.projectId]: summary },
          }));

          await apiSaveProjectSummary(summary.projectId, {
            project_id: summary.projectId,
            generated_at: summary.generatedAt,
            summary: summary.summary,
            toc: summary.toc,
            chapters: summary.chapters,
            proofreading_notes: summary.proofreadingNotes,
          });
        },

        clearProjectSummary: async (projectId) => {
          set((state) => {
            const next = { ...state.projectSummaries };
            next[projectId] = undefined;
            return { projectSummaries: next };
          });
          if (projectId) {
            try { await apiDeleteProjectSummary(projectId); } catch (error) { console.error('Failed to delete project summary', error); }
          }
        },

        clearAllSummaries: async () => {
          const ids = Object.keys(useOCRStore.getState().projectSummaries);
          set({ projectSummaries: {} });
          await Promise.allSettled(ids.map((id) => apiDeleteProjectSummary(id)));
        },

        resetAllData: async () => {
          const state = useOCRStore.getState();
          set({
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
          });

          await Promise.allSettled([
            ...state.results.map((result) => apiDeleteResult(result.id)),
            ...state.files.map((file) => apiDeleteFile(file.id)),
            ...state.projects.map((project) => apiDeleteProject(project.id)),
          ]);
        },

        syncAllResults: () => {
          set((state) => {
            const results = state.results.map(r => {
              const md = (r as any).metadata?.layoutMarkdown;
              if (md && typeof md === 'string' && md.trim()) {
                return { ...r, extractedText: md, layoutPreserved: md };
              }
              return r;
            });
            let currentResult = state.currentResult;
            if (currentResult) {
              currentResult = results.find(r => r.fileId === currentResult!.fileId) || currentResult;
            }
            return { results, currentResult };
          });
        },

        ensureOriginalSnapshots: () => {
          set((state) => {
            const results = state.results.map(r => {
              const meta: any = r.metadata || {};
              if (!meta.originalOCRText) {
                meta.originalOCRText = r.layoutPreserved || r.extractedText || '';
              }
              return { ...r, metadata: meta };
            });
            let currentResult = state.currentResult;
            if (currentResult) currentResult = results.find(r => r.fileId === currentResult!.fileId) || currentResult;
            return { results, currentResult };
          });
        },
      }),
      {
        name: 'ocr-storage',
        version: 3,
        migrate: (persistedState: any, version) => {
          if (!persistedState) return persistedState;
          if (version < 2 && persistedState.projectSummaries) {
            delete persistedState.projectSummaries;
          }
          if (persistedState.settings) {
            const s = persistedState.settings;
            if (version < 3) {
              if (!s.fallbackModel) s.fallbackModel = 'gemini-1.5-flash';
              if (!s.visionModel) {
                s.visionModel = s.model === 'gemini-pro-vision' ? 'gemini-pro-vision' : 'gemini-2.5-pro';
              }
              if (!s.model || s.model === 'gemini-1.5-flash') {
                s.model = 'gemini-2.5-pro';
              }
            }
          }
          return persistedState;
        },
        partialize: (state) => ({
          projects: state.projects,
          currentProjectId: state.currentProjectId,
          settings: state.settings,
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
