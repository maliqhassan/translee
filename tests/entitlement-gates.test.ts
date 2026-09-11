import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { PRO_BENEFITS } from '@/features/paywall/pro-benefits';
import { CAPABILITIES, PLAN_CAPABILITIES } from '@/services/entitlements';

/**
 * Where entitlement decisions are allowed to live.
 *
 * React Native cannot render under Node, so the Camera OCR gate is pinned
 * structurally: that the hook owns the decision, that no component makes one,
 * and that nothing reaches the recogniser without going past the gate. The
 * decision itself — feature, then device, then plan — is a pure function and
 * is unit-tested in `entitlements.test.ts`.
 */

const read = (path: string) => readFileSync(path, 'utf8');

const HOOK = 'src/features/translation/hooks/use-camera-ocr.ts';
const COMPOSER = 'src/features/translation/components/translation-composer.tsx';
const CAMERA_SCREEN = 'src/features/camera/screens/camera-screen.tsx';
const SETTINGS = 'src/features/settings/screens/settings-screen.tsx';
const REGISTRY = 'src/services/service-registry.ts';
const UPGRADE = 'src/features/paywall/screens/upgrade-screen.tsx';

/** Every `.ts`/`.tsx` file under a directory. */
function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) sources(path, found);
    else if (/\.tsx?$/.test(entry.name)) found.push(path);
  }
  return found;
}

/**
 * A file with its comments removed.
 *
 * These rules are about what the code *does*. Without this, a comment saying
 * "never write `plan === 'pro'` here" is itself flagged as writing it — which
 * is both wrong and a good way to teach everyone to stop explaining the rule.
 * Only whole comment lines and block comments are stripped, so a `//` inside
 * a string literal cannot silently eat the code after it.
 */
function code(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(?:\/\/|\*)/.test(line))
    .join('\n');
}

/**
 * Tokens that mean a file has taken an entitlement decision of its own.
 *
 * Named specifically rather than matching a word like "capability": the model
 * registry has had a `RuntimeCapability` since long before plans existed, and
 * a rule that cannot tell the two apart is a rule nobody will keep.
 */
const ENTITLEMENT_TOKENS = [
  'useEntitlements',
  'services.entitlements',
  'resolveFeatureAccess',
  'PLAN_CAPABILITIES',
  'hasActiveCapability',
  'EntitlementsService',
  ...CAPABILITIES.map((capability) => `'${capability}'`),
];

const decidesEntitlement = (source: string) =>
  ENTITLEMENT_TOKENS.some((token) => source.includes(token));

describe('commercial rules live in one place', () => {
  it('has no plan comparison anywhere outside the entitlements module', () => {
    // The single rule this whole design exists to enforce. A `plan === 'pro'`
    // in a screen is a commercial decision written where nobody will find it
    // again when the tiers change.
    const offenders = sources('src')
      .filter((path) => !path.startsWith('src/services/entitlements/'))
      .filter((path) =>
        /(?:plan|tier)\s*(?:===|!==)\s*['"]|['"](?:pro|free)['"]\s*(?:===|!==)/.test(code(path)),
      );

    assert.deepEqual(offenders, []);
  });

  it('lets only the entitlements module import the plan-to-capability table', () => {
    const offenders = sources('src')
      .filter((path) => !path.startsWith('src/services/entitlements/'))
      .filter((path) => code(path).includes('PLAN_CAPABILITIES'));

    assert.deepEqual(offenders, []);
  });

  it('keeps components out of it entirely', () => {
    // `src/components` is the shared design system. Nothing in it may know
    // that plans exist, let alone which one the user is on.
    const offenders = sources('src/components').filter(
      (path) => decidesEntitlement(code(path)) || /Entitlements/.test(code(path)),
    );

    assert.deepEqual(offenders, []);
  });

  it('keeps the composer reacting to the controller, never to a plan', () => {
    const composer = code(COMPOSER);

    assert.equal(decidesEntitlement(composer), false);
    // It only ever reads the status the controller published.
    assert.match(composer, /scan\?\.status === 'locked'/);
  });

  it('keeps the camera screen reacting to the controller, never to a plan', () => {
    const screen = code(CAMERA_SCREEN);

    assert.equal(decidesEntitlement(screen), false);
    assert.match(screen, /scan\.status === 'locked'/);
  });

  it('asks the paywall screen a capability question, not a plan one', () => {
    const screen = code(UPGRADE);

    assert.match(screen, /has\(benefit\.capability\)/);
    assert.equal(/plan\s*(?:===|!==)/.test(screen), false);
  });

  it('renders plan copy from a table, the way theme and mode copy already is', () => {
    const settings = read(SETTINGS);

    assert.match(settings, /PLAN_LABELS: Record<Plan, string>/);
    assert.match(settings, /PLAN_SUBTITLES: Record<Plan, string>/);
  });
});

describe('the Camera OCR decision lives in the controller', () => {
  it('is the hook that reads the entitlement', () => {
    const hook = read(HOOK);

    assert.match(hook, /useEntitlements/);
    assert.match(hook, /has\('cameraOcr'\)/);
  });

  it('resolves it through the shared three-layer rule, not its own if-chain', () => {
    const hook = read(HOOK);

    assert.match(hook, /resolveFeatureAccess/);
    assert.match(hook, /shipped: FEATURES\.cameraOcr/);
    assert.match(hook, /supported,/);
    assert.match(hook, /entitled: has\('cameraOcr'\)/);
  });

  it('keeps the build flag as the first question', () => {
    const hook = read(HOOK);

    // The device is asked only when the capability shipped, so a build
    // without it never probes the recogniser at all.
    assert.match(hook, /if \(FEATURES\.cameraOcr\) \{[\s\S]*services\.ocr\.isAvailable\(\)/);
  });

  it('offers nothing at all until both answers are in', () => {
    // Otherwise a Pro user sees the lock flash up between the device probe
    // resolving and their plan arriving.
    assert.match(read(HOOK), /supported === undefined \|\| !loaded\s*\?\s*'unavailable'/);
  });

  it('publishes locked as a status of its own', () => {
    const hook = read(HOOK);

    assert.match(hook, /\| 'locked'/);
    assert.match(hook, /status: ScanStatus/);
  });
});

describe('a free user cannot reach the recogniser', () => {
  it('refuses to open the scanner', () => {
    assert.match(read(HOOK), /const open = useCallback\(\(\) => \{\s*if \(!allowed\) return;/);
  });

  it('refuses to recognise a capture even if one arrives', () => {
    // A second guard, so no stale callback or sheet left open can reach the
    // recogniser without the entitlement.
    assert.match(read(HOOK), /if \(!allowed \|\| reading\.current\) return;/);
  });

  it('reaches the recogniser only through the service, as before', () => {
    const hook = read(HOOK);

    assert.match(hook, /services\.ocr\.recognize/);
    // The gate did not become an excuse to move OCR out from behind the
    // service boundary.
    assert.equal(hook.includes('TranseeOcr'), false);
    assert.equal(hook.includes('expo-camera'), false);
  });

  it('leaves the OCR implementation itself untouched by entitlements', () => {
    const offenders = sources('src/services/ocr').filter((path) => decidesEntitlement(code(path)));

    assert.deepEqual(offenders, [], 'recognising text is not where plans belong');
  });
});

describe('an unsupported device is never sold anything', () => {
  it('refuses to open the paywall unless the feature is locked', () => {
    assert.match(read(HOOK), /if \(access !== 'locked'\) return;\s*router\.push\('\/upgrade'\)/);
  });

  it('hides the scan control entirely when it is unavailable', () => {
    const composer = read(COMPOSER);

    assert.match(composer, /canScan = scan && scan\.status !== 'unavailable'/);
    assert.match(composer, /\{canScan \?/);
  });

  it('keeps the device message and the plan message apart on the camera tab', () => {
    const screen = read(CAMERA_SCREEN);

    // Unavailable says what the build cannot do and offers nothing.
    assert.match(screen, /Scanning is not in this build/);
    assert.equal(/Scanning is not in this build[\s\S]{0,400}scan\.upgrade/.test(screen), false);

    // Locked says what the plan does not include and offers the upgrade.
    assert.match(screen, /Camera text recognition is part of Transee Pro/);
    assert.match(screen, /onPress=\{scan\.upgrade\}/);
  });

  it('leads a locked scan button to the paywall rather than the camera', () => {
    const composer = read(COMPOSER);

    assert.match(composer, /icon="lock-closed-outline"[\s\S]{0,200}onPress=\{scan\.upgrade\}/);
    assert.match(composer, /icon="camera-outline"[\s\S]{0,200}onPress=\{scan\.open\}/);
  });
});

describe('the development switcher cannot ship', () => {
  it('is the only thing the registry exposes a setter through', () => {
    const registry = read(REGISTRY);

    assert.match(registry, /const entitlementsService: EntitlementsService = localEntitlements/);
    assert.match(registry, /entitlements: entitlementsService/);
  });

  it('is behind a compile-time constant the bundler folds away', () => {
    assert.match(
      read(REGISTRY),
      /developmentEntitlements: DevelopmentEntitlementsService \| undefined = __DEV__\s*\?\s*localEntitlements\s*:\s*undefined/,
    );
  });

  it('keeps setPlan off the contract the app depends on', () => {
    const contract = read('src/services/entitlements/entitlements-service.ts');

    const base = contract.slice(
      contract.indexOf('export type EntitlementsService'),
      contract.indexOf('export type DevelopmentEntitlementsService'),
    );

    assert.ok(base.length > 0, 'both types are declared');
    assert.equal(base.includes('setPlan'), false, 'the base contract must have no setter');
    assert.match(
      contract,
      /DevelopmentEntitlementsService = EntitlementsService & \{[\s\S]*setPlan/,
    );
  });

  it('is reachable from the UI only through the development-only hook', () => {
    const offenders = sources('src')
      .filter((path) => path !== 'src/store/entitlements-store.tsx' && path !== REGISTRY)
      .filter((path) => read(path).includes('developmentEntitlements'));

    assert.deepEqual(offenders, []);
  });

  it('renders nothing in settings when there is no switcher', () => {
    const settings = read(SETTINGS);

    assert.match(settings, /const planSwitcher = useDevelopmentPlanSwitcher\(\)/);
    assert.match(settings, /\{planSwitcher \? \(/);
    assert.match(settings, /\) : null\}/);
  });

  it('says plainly that it is not a purchase', () => {
    assert.match(read(SETTINGS), /not a purchase/i);
  });

  it('never calls a setter from a screen or component', () => {
    const offenders = sources('src')
      .filter((path) => !path.startsWith('src/services/entitlements/'))
      .filter((path) => path !== 'src/store/entitlements-store.tsx')
      .filter((path) => /services\.entitlements\.setPlan|\.setPlan\(/.test(read(path)))
      .filter((path) => !path.includes('settings-screen'));

    assert.deepEqual(offenders, []);
  });
});

describe('the entitlement system is wired in', () => {
  it('is bound in the registry over the existing storage seam', () => {
    const registry = read(REGISTRY);

    assert.match(registry, /createLocalEntitlementsService\(/);
    assert.match(
      registry,
      /createFilePreferencesStorage\(`\$\{STORAGE_KEYS\.entitlements\}\.json`\)/,
    );
  });

  it('introduced no new persistence dependency', () => {
    const offenders = sources('src/services/entitlements').filter((path) =>
      /expo-file-system|expo-sqlite|async-storage|expo-secure-store/.test(read(path)),
    );

    assert.deepEqual(offenders, [], 'entitlements reuse the preferences storage seam');
  });

  it('is composed into the provider tree', () => {
    const providers = read('src/store/app-providers.tsx');

    assert.match(providers, /<EntitlementsProvider>/);
    assert.match(providers, /<\/EntitlementsProvider>/);
  });

  it('re-publishes to the non-React bridge on every change', () => {
    const store = read('src/store/entitlements-store.tsx');

    assert.match(store, /publishActiveEntitlements/);
    assert.match(store, /services\.entitlements\.subscribe\(sync\)/);
  });

  it('has a route for the upgrade screen, as a one-line re-export', () => {
    assert.equal(
      read('app/upgrade.tsx').trim(),
      "export { UpgradeScreen as default } from '@/features/paywall';",
    );
    assert.match(read('app/_layout.tsx'), /name="upgrade"/);
  });
});

describe('the paywall is a placeholder and says so', () => {
  it('lists exactly the capabilities Pro grants', () => {
    assert.deepEqual(
      PRO_BENEFITS.map((benefit) => benefit.capability),
      [...PLAN_CAPABILITIES.pro],
    );
  });

  it('leaves no capability unexplained', () => {
    for (const capability of CAPABILITIES) {
      assert.ok(
        PRO_BENEFITS.some((benefit) => benefit.capability === capability),
        `${capability} is sold but never described`,
      );
    }
  });

  it('cannot take money or grant a plan', () => {
    const screen = code(UPGRADE);

    assert.match(screen, /disabled/);
    assert.match(screen, /coming soon/i);
    assert.equal(screen.includes('setPlan'), false);
    for (const word of ['purchase(', 'billing', 'revenuecat', 'sku', 'price']) {
      assert.equal(screen.toLowerCase().includes(word), false, word);
    }
  });

  it('adds no billing dependency', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };

    for (const name of Object.keys(pkg.dependencies)) {
      assert.equal(
        /billing|purchase|revenuecat|iap|admob|ads/i.test(name),
        false,
        `${name} is not part of this step`,
      );
    }
  });

  it('carries no subscription secret and no new public variable', () => {
    for (const path of [
      ...sources('src/services/entitlements'),
      ...sources('src/features/paywall'),
    ]) {
      const source = read(path).toLowerCase();
      for (const word of ['expo_public_', 'apikey', 'api_key', 'secret', 'token']) {
        assert.equal(source.includes(word), false, `${word} in ${path}`);
      }
    }
  });

  it('states in the code that this is not purchase enforcement', () => {
    const contract = read('src/services/entitlements/entitlements-service.ts');
    const local = read('src/services/entitlements/local-entitlements-service.ts');

    assert.match(contract, /not purchase enforcement/i);
    assert.match(local, /not a licence check/i);
  });
});

describe('nothing else was gated', () => {
  it('leaves speech recognition ungated', () => {
    assert.equal(
      decidesEntitlement(code('src/features/translation/hooks/use-speech-recognition.ts')),
      false,
    );
  });

  it('leaves text-to-speech ungated', () => {
    assert.equal(decidesEntitlement(code('src/features/translation/hooks/use-speak.ts')), false);
  });

  it('leaves offline translation and language packs exactly as they were', () => {
    for (const path of [
      'src/features/offline/hooks/use-language-pack-status.ts',
      'src/features/offline/hooks/use-language-packs.ts',
      'src/features/offline/screens/language-packs-screen.tsx',
    ]) {
      assert.equal(decidesEntitlement(code(path)), false, path);
    }
  });

  it('leaves translation routing untouched by entitlements', () => {
    const offenders = sources('src/services/translation').filter((path) =>
      decidesEntitlement(code(path)),
    );

    assert.deepEqual(offenders, [], 'routing is a later product decision');
  });

  it('still admits both real engines exactly as before', () => {
    // The one thing that would quietly gate offline translation is a change
    // to the candidate list. It is untouched.
    const registry = code(REGISTRY);

    assert.match(registry, /const translationEngines: readonly TranslationService\[\] = \[/);
    assert.match(registry, /onlineTranslationService,\s*offlineEngine,/);
  });
});
