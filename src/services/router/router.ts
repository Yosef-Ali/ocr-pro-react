import { OCRFile, Settings } from '@/types';
import { predictRoute } from './learnedRouter';

export type RouteDecision = 'local' | 'cloud';

export interface RouteContext {
    file: OCRFile;
    settings: Settings;
    previewBase64?: string | null;
    // Optional lightweight features to feed learned router later
    features?: Record<string, number | string | boolean>;
}

export function decideRoute(ctx: RouteContext): RouteDecision {
    const { settings, file } = ctx;

    // Respect explicit routing
    if (settings.routingMode === 'local-only') return 'local';
    if (settings.routingMode === 'cloud-only') return 'cloud';

    // Learned router path if enabled
    if (settings.routerStrategy === 'learned') {
        const label = predictRoute(ctx) as RouteDecision | null;
        if (label === 'local' || label === 'cloud') return label;
    }

    // Heuristics fallback
    const isTiff = /image\/(tiff|x-tiff)/i.test(file.type) || /\.(tif|tiff)$/i.test(file.name);
    if (isTiff) return 'local';

    const hasGeminiKey = !!(settings.apiKey && settings.apiKey.trim());
    const hasAnyKey = hasGeminiKey || !!(settings.openRouterApiKey && settings.openRouterApiKey.trim());

    // If Amharic mode is forced and Gemini is available, keep processing in the cloud to leverage Gemini 2.5 Pro.
    if (settings.forceAmharic && hasGeminiKey) return 'cloud';

    // Prefer cloud if user configured API keys and not marked strict local
    return hasAnyKey ? 'cloud' : 'local';
}
