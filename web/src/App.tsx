import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { DashboardPage } from '@/pages/DashboardPage'
import { AuthPage } from '@/pages/AuthPage'
import { CreateSessionPage } from '@/pages/CreateSessionPage'
import { JoinSessionPage } from '@/pages/JoinSessionPage'
import { SessionPage } from '@/pages/SessionPage'
import { FriendsPage } from '@/pages/FriendsPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage'
import { TermsOfServicePage } from '@/pages/TermsOfServicePage'
import { InviteToast } from '@/components/ui/invite-toast'
import { PostHogPageView } from '@/components/analytics/PostHogPageView'
import { useAuth } from '@/hooks/use-auth'
import { usePostHogIdentify } from '@/hooks/use-posthog-identify'
import { captureAppException, safeSerializeKey } from '@/lib/posthog-error-reporting.ts'

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error, query) {
      captureAppException(error, {
        error_source: 'tanstack_query',
        query_key: safeSerializeKey(query.queryKey),
      })
    },
  }),
  mutationCache: new MutationCache({
    onError(error, _variables, _onMutateResult, mutation) {
      captureAppException(error, {
        error_source: 'tanstack_mutation',
        mutation_key:
          mutation.options.mutationKey != null ?
            safeSerializeKey(mutation.options.mutationKey)
          : undefined,
      })
    },
  }),
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />
  }
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/auth" element={<AuthPage />} />

      <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="friends" element={<FriendsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="/create" element={<ProtectedRoute><CreateSessionPage /></ProtectedRoute>} />
      <Route path="/join/:code" element={<ProtectedRoute><JoinSessionPage /></ProtectedRoute>} />
      <Route path="/join" element={<ProtectedRoute><JoinSessionPage /></ProtectedRoute>} />
      <Route path="/session/:id" element={<ProtectedRoute><SessionPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  usePostHogIdentify()

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
          {import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN ? <PostHogPageView /> : null}
          <InviteToast />
          <AppRoutes />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
