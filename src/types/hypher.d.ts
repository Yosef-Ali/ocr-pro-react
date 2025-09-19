declare module 'hypher' {
    interface HypherPattern { }
    class Hypher {
        constructor(patterns: any);
        hyphenate(word: string): string[];
    }
    export default Hypher;
}
declare module 'hyphenation.en-us' {
    const patterns: any;
    export default patterns;
}
