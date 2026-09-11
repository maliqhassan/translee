import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Badge, Button, Card, Icon, IconButton, Screen, ScreenHeader, Text } from '@/components';
import { APP } from '@/constants';
import { useTheme } from '@/hooks';
import { useEntitlements } from '@/store';

import { PRO_BENEFITS } from '../pro-benefits';

/**
 * What Transee Pro is, and — for now — an honest statement that it cannot be
 * bought yet.
 *
 * Deliberately a placeholder. There is no billing SDK, no store product and no
 * receipt to validate, so there is no button here that could take money, and
 * nothing on this screen changes the user's plan. Faking a purchase would put
 * the app one tap away from claiming an entitlement it never granted.
 */
export function UpgradeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { has } = useEntitlements();

  /*
   * Asked as a capability question, not `plan === 'pro'`.
   *
   * It is also the more correct question: if a benefit ever moves between
   * tiers, this stays right without being edited.
   */
  const hasEveryBenefit = PRO_BENEFITS.every((benefit) => has(benefit.capability));

  return (
    <Screen scrollable edges={['top', 'bottom']}>
      <ScreenHeader
        title={`${APP.name} Pro`}
        subtitle="Everything in the free plan, and the features that need more than a connection"
        leading={
          <IconButton
            name="chevron-back-outline"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
          />
        }
      />

      <Card variant="outlined" padding="none">
        {PRO_BENEFITS.map((benefit, index) => (
          <View
            key={benefit.capability}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: theme.spacing.md,
              paddingHorizontal: theme.spacing.base,
              paddingTop: index === 0 ? theme.spacing.base : theme.spacing.md,
              paddingBottom: index === PRO_BENEFITS.length - 1 ? theme.spacing.base : 0,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radius.sm,
                backgroundColor: theme.colors.primaryMuted,
              }}
            >
              <Icon name={benefit.icon} size={18} color="primary" />
            </View>

            <View style={{ flex: 1, gap: theme.spacing.xxs }}>
              <Text variant="body">{benefit.title}</Text>
              <Text variant="bodySmall" color="textSecondary">
                {benefit.description}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      {hasEveryBenefit ? (
        <Card variant="outlined" style={{ gap: theme.spacing.sm, alignItems: 'flex-start' }}>
          <Badge label="Pro" tone="primary" icon="checkmark-circle-outline" />
          <Text variant="bodySmall" color="textSecondary">
            You already have every Pro feature on this device.
          </Text>
        </Card>
      ) : (
        <Card variant="outlined" style={{ gap: theme.spacing.md }}>
          <Text variant="body">Subscriptions are coming soon</Text>
          <Text variant="bodySmall" color="textSecondary">
            There is nothing to buy yet. When subscriptions open, Pro will be a purchase through
            your app store, and this screen is where it will happen.
          </Text>

          {/* Disabled rather than absent: the shape of the thing is worth
              showing, but it must not look as though a tap would buy
              anything. Nothing here can grant a plan. */}
          <Button
            label="Subscriptions coming soon"
            icon="time-outline"
            size="lg"
            fullWidth
            disabled
            accessibilityHint="Transee Pro cannot be purchased yet"
          />
        </Card>
      )}

      <Text variant="caption" color="textMuted" align="center">
        Translations and settings stay on this device, on either plan.
      </Text>
    </Screen>
  );
}
