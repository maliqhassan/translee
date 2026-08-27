import { useRouter } from 'expo-router';

import { EmptyState, Screen } from '@/components';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen>
      <EmptyState
        icon="alert-circle-outline"
        title="Page not found"
        description="That screen does not exist."
        actionLabel="Go to Translate"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
