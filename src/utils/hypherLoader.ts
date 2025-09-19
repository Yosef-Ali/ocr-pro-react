let hypherInstance: any = null;
let loading: Promise<any> | null = null;

export async function getHypher() {
    if (hypherInstance) return hypherInstance;
    if (loading) return loading;
    loading = (async () => {
        try {
            const [{ default: Hypher }, { default: english }] = await Promise.all([
                import(/* @vite-ignore */ 'hypher'),
                import(/* @vite-ignore */ 'hyphenation.en-us')
            ]);
            hypherInstance = new Hypher(english);
            return hypherInstance;
        } catch (e) {
            console.warn('[hypherLoader] Failed to load hypher:', e);
            return null;
        } finally {
            loading = null;
        }
    })();
    return loading;
}

export function isHypherReady() { return !!hypherInstance; }
