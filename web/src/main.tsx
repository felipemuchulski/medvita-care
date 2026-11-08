import { StrictMode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import App from './App'
import '@fontsource/montserrat/latin-400.css'
import '@fontsource/montserrat/latin-500.css'
import '@fontsource/montserrat/latin-600.css'
import '@fontsource/montserrat/latin-700.css'
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-600.css'
import '@fontsource/roboto/latin-700.css'
import './index.css'
import { AuthProvider } from './contexts/AuthProvider'
import { ClinicProvider } from './contexts/ClinicProvider'
import { queryClient } from './lib/query-client'

const router = createBrowserRouter([{ path: '*', element: <App /> }])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ClinicProvider>
          <RouterProvider router={router} />
        </ClinicProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
