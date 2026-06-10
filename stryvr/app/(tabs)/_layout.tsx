import { Tabs } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LIGHT, BORDERS, TAB_BAR } from '../../constants/theme'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

// ─── TAB ICON WRAPPER ────────────────────────────────────────────────────────
// Tab active = rectangle quasi-carré noir, radius-sm (8px) — PAS pill

function TabIcon({
  name,
  focused,
}: {
  name: IoniconName
  focused: boolean
}) {
  if (focused) {
    return (
      <View style={styles.activeContainer}>
        <Ionicons
          name={name}
          size={TAB_BAR.iconSize}
          color={LIGHT.tabActiveIcon}
        />
      </View>
    )
  }
  return (
    <Ionicons
      name={name}
      size={TAB_BAR.iconSize}
      color={LIGHT.tabInactiveIcon}
    />
  )
}

// ─── LAYOUT ─────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: TAB_BAR.height + insets.bottom,
          backgroundColor: LIGHT.surfaceTabBar,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: LIGHT.borderSubtle,
          paddingBottom: insets.bottom,
          paddingHorizontal: 8,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'document' : 'document-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'heart' : 'heart-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} focused={focused} />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  activeContainer: {
    width: TAB_BAR.activeSize,
    height: TAB_BAR.activeSize,
    backgroundColor: LIGHT.tabActiveBg,
    borderRadius: TAB_BAR.activeRadius,  // 8px — rectangle, PAS pill
    alignItems: 'center',
    justifyContent: 'center',
  },
})
