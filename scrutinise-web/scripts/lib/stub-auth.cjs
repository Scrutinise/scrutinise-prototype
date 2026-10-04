// A TEST SEAM FOR SCRIPTS ONLY — never imported by the product.
//
// Preloaded with `--require` BEFORE anything else, because ES imports are hoisted above any statement in a script and the
// product's route handlers capture `lib/auth` when they first load. It replaces exactly ONE function —
// `getAuthenticatedUser()`, the Clerk session read — with whatever `globalThis.__STUB_AUTH_USER` holds at call time.
// Nothing else in the product is touched: authorisation, the confirm token, the route's own gates, the models and the
// ledger all run as they do in production. With no stub user set it behaves exactly as the real function.
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/verify-lex-26p-run.ts 452c5ade

const Module = require('module')
const orig = Module._load
Module._load = function (request) {
  const m = orig.apply(this, arguments)
  if (typeof request === 'string' && (request === '@/lib/auth' || /[\\/]lib[\\/]auth(\.[cm]?[tj]s)?$/.test(request))) {
    return new Proxy(m, {
      get(target, key, receiver) {
        if (key === 'getAuthenticatedUser' && globalThis.__STUB_AUTH_USER) {
          return async () => ({ error: null, user: globalThis.__STUB_AUTH_USER })
        }
        return Reflect.get(target, key, receiver)
      },
    })
  }
  return m
}
