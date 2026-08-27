import { Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components';
import { useTheme } from '@/hooks';

type TabConfig = {
  name: string;
  title: string;
  icon: IconName;
  iconActive: IconName;
};

/** Declaring tabs as data keeps the layout free of repeated JSX. */
const TABS: readonly TabConfig[] = [
  { name: 'index', title: 'Translate', icon: 'language-outline', iconActive: 'language' },
  { name: 'camera', title: 'Camera', icon: 'camera-outline', iconActive: 'camera' },
  { name: 'history', title: 'History', icon: 'time-outline', iconActive: 'time' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
];

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.tabBarBorder,
          height: theme.layout.tabBarHeight,
        },
        tabBarLabelStyle: theme.typography.variants.caption,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => (
              <Icon
                name={focused ? tab.iconActive : tab.icon}
                size={22}
                color={focused ? 'tabBarActive' : 'tabBarInactive'}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
