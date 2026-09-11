import type { IconName } from '@/components';
import type { Capability } from '@/services';

/**
 * What Transee Pro is, in the user's words.
 *
 * Each line names the capability it stands for, so the list cannot drift out
 * of step with `PLAN_CAPABILITIES` without a test noticing. Copy lives in the
 * feature rather than in `src/constants`, because constants may not import
 * from the service layer — the same reason `offlineNotice` lives in the
 * offline feature.
 */
export type ProBenefit = {
  capability: Capability;
  icon: IconName;
  title: string;
  description: string;
};

export const PRO_BENEFITS: readonly ProBenefit[] = [
  {
    capability: 'cameraOcr',
    icon: 'camera-outline',
    title: 'Camera text recognition',
    description: 'Point the camera at a menu, a sign or a page and translate what it reads.',
  },
  {
    capability: 'speechRecognition',
    icon: 'mic-outline',
    title: 'Speech-to-text',
    description: 'Dictate instead of typing, in the language you are translating from.',
  },
  {
    capability: 'offlineTranslation',
    icon: 'cloud-offline-outline',
    title: 'Offline translation',
    description: 'Download language packs and keep translating with no connection at all.',
  },
  {
    capability: 'adFree',
    icon: 'sparkles-outline',
    title: 'Ad-free experience',
    description: 'No advertisements anywhere in the app.',
  },
  {
    capability: 'extendedOnlineQuota',
    icon: 'flash-outline',
    title: 'Extended online translation',
    description: 'A much higher daily allowance for online translations.',
  },
];
