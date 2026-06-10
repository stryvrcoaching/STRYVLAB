import { Stack, Redirect } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import {
  useFonts,
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
} from '@expo-google-fonts/urbanist'
import { useAuth } from '../lib/hooks/useAuth'
import { LIGHT } from '../constants/theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
})

function RootLayoutNav() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return null

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: LIGHT.surfaceBase },
        headerTintColor: LIGHT.textPrimary,
        headerTitleStyle: {
          fontFamily: 'Urbanist_600SemiBold',
          fontSize: 17,
        },
        contentStyle: { backgroundColor: LIGHT.surfaceBase },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Urbanist_400Regular,
    Urbanist_500Medium,
    Urbanist_600SemiBold,
    Urbanist_700Bold,
  })

  // Attendre que les fonts soient chargées avant de rendre
  if (!fontsLoaded) return null

  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
      <StatusBar style="dark" backgroundColor={LIGHT.surfaceBase} />
    </QueryClientProvider>
  )
}
