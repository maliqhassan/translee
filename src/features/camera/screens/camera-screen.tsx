import { useRouter } from 'expo-router';

import { EmptyState, Screen, ScreenHeader } from '@/components';
import { FEATURES } from '@/constants';

/**
 * Camera translation shell. The live preview, permission flow and OCR overlay
 * are added on the camera day; until then the screen states its own status.
 */
export function CameraScreen() {
  const router = useRouter();

  return (
    <Screen>
      <ScreenHeader title="Camera" subtitle="Point at text to translate it" />
      <EmptyState
        icon="camera-outline"
        title={FEATURES.cameraOcr ? 'Scan from the Translate tab' : 'Camera translation is coming'}
        description={
          FEATURES.cameraOcr
            ? 'The camera button sits next to the text box, so scanned text lands straight in the draft you are about to translate.'
            : 'Scan menus, signs and documents, then translate the recognised text in place.'
        }
        actionLabel={FEATURES.cameraOcr ? 'Go to Translate' : undefined}
        onAction={FEATURES.cameraOcr ? () => router.replace('/') : undefined}
      />
    </Screen>
  );
}
