import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { Router } from "@/router"
import { TemaProvider } from "@/hooks/useTema"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data publik hanya berubah saat admin publish, jadi 5 menit aman.
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TemaProvider>
        <Router />
      </TemaProvider>
    </QueryClientProvider>
  )
}

export default App
