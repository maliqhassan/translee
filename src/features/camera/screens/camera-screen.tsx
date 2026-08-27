import { EmptyState, Screen, ScreenHeader } from '@/components';
import { FEATURES } from '@/constants';

/**
 * Camera translation shell. The live preview, permission flow and OCR overlay
 * are added on the camera day; until then the screen states its own status.
 */
export function CameraScreen() {
  return (
    <Screen>
      <ScreenHeader title="Camera" subtitle="Point at text to translate it" />
      <EmptyState
        icon="camera-outline"
        title={FEATURES.cameraOcr ? 'Camera ready' : 'Camera translation is coming'}
        description="Scan menus, signs and documents, then translate the recognised text in place."
      />
    </Screen>
  );
}
