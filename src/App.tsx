// Main App Component
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Header } from '@/components/layout/Header';
import { UploadSection } from '@/components/upload/UploadSection';
import { ResultsSection } from '@/components/results/ResultsSection';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { HelpModal } from '@/components/modals/HelpModal';
import { useOCRStore } from '@/store/ocrStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

function App() {
  const { isSettingsOpen, isHelpOpen } = useOCRStore();

  return (
    <QueryClientProvider client={queryClient}>
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
        {isSettingsOpen && <SettingsModal />}
        {isHelpOpen && <HelpModal />}

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
    </QueryClientProvider>
  );
}

export default App;
