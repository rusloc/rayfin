import { lazy, Suspense } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/AuthContext';
import { HomePage } from '@/pages/HomePage';

// Lazy so AG Grid only loads when the PO view is opened.
const PoViewPage = lazy(() =>
  import('@/pages/PoViewPage').then((m) => ({ default: m.PoViewPage }))
);

/** The route a visitor asked for before being sent to sign in. */
interface AuthRedirectState {
  from?: string;
}

/**
 * Resolves where to send a visitor after they sign in.
 *
 * Only same-origin application paths are accepted, so a crafted value cannot
 * send the visitor off-site, and the sign-in route itself is rejected so
 * sign-in cannot loop.
 */
function resolveReturnPath(state: unknown): string {
  const from = (state as AuthRedirectState | null)?.from;

  if (typeof from !== 'string' || !from.startsWith('/')) return '/';
  if (from.startsWith('//') || from.startsWith('/\\')) return '/';
  if (
    from === '/auth' ||
    from.startsWith('/auth/') ||
    from.startsWith('/auth?')
  ) {
    return '/';
  }

  return from;
}

function AuthGuard({
  children,
  requireAuth,
}: {
  children: React.ReactNode;
  requireAuth: boolean;
}) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Carry the requested route through sign-in. Without this, a shared link
  // opened by a signed-out visitor always lands on the default page.
  if (requireAuth && !isAuthenticated) {
    const redirectState: AuthRedirectState = {
      from: `${location.pathname}${location.search}`,
    };
    return <Navigate to="/auth" replace state={redirectState} />;
  }

  if (!requireAuth && isAuthenticated) {
    return <Navigate to={resolveReturnPath(location.state)} replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      {/* ensure all new routes require auth */}
      <Routes>
        <Route
          path="/auth"
          element={
            <AuthGuard requireAuth={false}>
              <AuthPage />
            </AuthGuard>
          }
        />
        <Route path="/" element={<Navigate to="/po" replace />} />
        {/* Names register: hidden from the nav, reachable by URL only. */}
        <Route
          path="/names"
          element={
            <AuthGuard requireAuth={true}>
              <HomePage />
            </AuthGuard>
          }
        />
        <Route
          path="/po"
          element={
            <AuthGuard requireAuth={true}>
              <Suspense fallback={null}>
                <PoViewPage />
              </Suspense>
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
