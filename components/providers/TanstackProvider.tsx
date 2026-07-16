'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export default function TanstackProvider({ children }: { children: React.ReactNode }) {
  // Use useState to ensure QueryClient is instantiated only once
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 24 * 60 * 60 * 1000, // 24 hours (gcTime is the new name for cacheTime in v5)
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
