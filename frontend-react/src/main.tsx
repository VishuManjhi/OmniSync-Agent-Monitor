import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/globals.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { WebSocketProvider } from './context/SocketContext'
import { MessagingProvider } from './context/MessagingContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <WebSocketProvider>
            <MessagingProvider>
              <App />
            </MessagingProvider>
          </WebSocketProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)

