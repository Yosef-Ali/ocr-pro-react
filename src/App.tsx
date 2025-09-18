import { Toaster } from 'react-hot-toast';
import { Header } from '@/components/layout/Header';
import { UploadSection } from '@/components/upload/UploadSection';
import { ResultsSection } from '@/components/results/ResultsSection';
import { useOCRStore } from '@/store/ocrStore';
import { AuthProvider } from '@/contexts/AuthContext';
import { lazy, Suspense, useEffect } from 'react';

const SettingsModal = lazy(() => import('@/components/modals/SettingsModal').then(module => ({ default: module.SettingsModal })));
const HelpModal = lazy(() => import('@/components/modals/HelpModal').then(module => ({ default: module.HelpModal })));

function App() {
  const { isSettingsOpen, isHelpOpen, hydrateFromRemote, isRemoteHydrated } = useOCRStore();

  useEffect(() => {
    if (!isRemoteHydrated) {
      hydrateFromRemote().catch((error) => {
        console.error('Remote hydration failed', error);
      });
    }
  }, [hydrateFromRemote, isRemoteHydrated]);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />

        <main className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <UploadSection />
            </div>
            <div className="lg:col-span-2">
              <ResultsSection />
            </div>
          </div>
        </main>

        {/* Modals */}
        <Suspense fallback={null}>
          {isSettingsOpen && <SettingsModal />}
          {isHelpOpen && <HelpModal />}
        </Suspense>

        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
      </div>
    </AuthProvider>
  );
}

export default App;
