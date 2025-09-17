import { RouteContext, RouteDecision } from './router';

// Placeholder for a future on-device classifier (e.g., MobileBERT via ONNX/WebGPU)
// Return null to allow fallback to heuristics.
export function predictRoute(_ctx: RouteContext): RouteDecision | null {
    return null;
}
