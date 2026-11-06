import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/query'
import { router } from '@/router'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-left"
        toastOptions={{
          style: {
            background: '#241612',
            border: '1px solid #3F2319',
            color: '#F5F1EB',
            fontFamily: '"Roboto Mono", monospace',
            fontSize: '12px',
            pointerEvents: 'none',
          },
        }}
      />
    </QueryClientProvider>
  )
}

export default App
