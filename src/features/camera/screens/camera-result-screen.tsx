import { EmptyState, Screen, ScreenHeader } from '@/components';

/**
 * Review surface for a captured frame: recognised blocks on the left, their
 * translations on the right. Populated on the camera day.
 */
export function CameraResultScreen() {
  return (
    <Screen>
      <ScreenHeader title="Scan result" />
      <EmptyState
        icon="scan-outline"
        title="Nothing scanned yet"
        description="Recognised text and its translation will be shown here after a capture."
      />
    </Screen>
  );
}
