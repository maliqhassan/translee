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
  /**
   * The native SQLite module cannot load under Node. Tests never use this
   * driver: they build the repository over the Node SQLite driver in
   * `tests/support`, so the SQL under test is still run by a real engine.
   */
  /**
   * The platform speech engine cannot load under Node. TTS tests drive
   * `createExpoTTSService` with an injected fake, so this stub only has to
   * exist for the module-level default binding in the registry.
   */
  'expo-speech': {
    speak: () => {
      throw new Error('expo-speech is unavailable under Node.');
    },
    stop: async () => {},
    getAvailableVoicesAsync: async () => [],
    isSpeakingAsync: async () => false,
    maxSpeechInputLength: 4000,
  },
  'expo-sqlite': {
    openDatabaseAsync: async () => {
      throw new Error('expo-sqlite is unavailable under Node; use createNodeSQLiteDatabase.');
    },
  },
  /**
   * Preferences tests drive `createPreferencesService` with an in-memory
   * storage slot, so the file-backed implementation is never exercised here.
   */
  /**
   * The ML Kit module is resolved optionally, so under Node it simply is not
   * there — which is exactly the "no native build" case the engine must handle.
   */
  'expo-modules-core': {
    requireOptionalNativeModule: () => null,
    requireNativeModule: () => {
      throw new Error('Native modules are unavailable under Node.');
    },
  },
  'expo-file-system': {
    File: class {
      get exists() {
        throw new Error('expo-file-system is unavailable under Node.');
      }
    },
    Directory: class {},
    Paths: { document: {}, cache: {} },
  },
};

for (const [name, exports] of Object.entries(STUBS)) {
  const id = `stub:${name}`;
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(STUBS, request)) return `stub:${request}`;
  if (request.startsWith('@modules/')) {
    return originalResolve.call(
      this,
      path.join(REPO_ROOT, '.test-build', 'modules', request.slice('@modules/'.length)),
      ...rest,
    );
  }
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
