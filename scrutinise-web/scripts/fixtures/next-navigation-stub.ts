// check:lex-26ac's harness only: next/navigation outside Next. `refresh` is counted so the check can see a control asked for it.
const w = (typeof window !== 'undefined' ? window : {}) as { __refreshes?: number }
export function useRouter() { return { refresh: () => { w.__refreshes = (w.__refreshes ?? 0) + 1 }, push: () => undefined, replace: () => undefined, back: () => undefined } }
export function usePathname() { return '/' }
export function useSearchParams() { return new URLSearchParams() }
