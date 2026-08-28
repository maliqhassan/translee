/**
 * Module hook for the unit tests.
 *
 * The tests exercise the real compiled modules, which means resolving the `@/`
 * alias exactly as Metro does, and standing in for the two native packages the
 * service layer imports. Everything else runs for real.
 */
const path = require('path');
const Module = require('module');

const REPO_ROOT = path.resolve(__dirname, '..');
const BUILD_ROOT = path.join(REPO_ROOT, '.test-build', 'src');
/** `@shared/*` resolves to the repo's shared data, not to build output. */
const SHARED_ROOT = path.join(REPO_ROOT, 'shared');

// `__DEV__` is a Metro global; the logger reads it at module load.
globalThis.__DEV__ = false;

/**
 * Native modules cannot load under Node. These stubs cover only what the code
 * under test touches; anything else would throw loudly rather than pass
 * silently.
 */
const STUBS = {
  'react-native': {
    Platform: { OS: 'android', select: (o) => ('android' in o ? o.android : o.default) },
    StyleSheet: { hairlineWidth: 1, create: (s) => s, absoluteFillObject: {} },
  },
  'expo-network': {
    getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
    addNetworkStateListener: () => ({ remove: () => {} }),
  },
  'expo-clipboard': {
    setStringAsync: async () => true,
    getStringAsync: async () => '',
    hasStringAsync: async () => false,
  },
};

for (const [name, exports] of Object.entries(STUBS)) {
  const id = `stub:${name}`;
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(STUBS, request)) return `stub:${request}`;
  if (request.startsWith('@shared/')) {
    return originalResolve.call(
      this,
      path.join(SHARED_ROOT, request.slice('@shared/'.length)),
      ...rest,
    );
  }
  if (request.startsWith('@/')) {
    return originalResolve.call(this, path.join(BUILD_ROOT, request.slice(2)), ...rest);
  }
  return originalResolve.call(this, request, ...rest);
};
