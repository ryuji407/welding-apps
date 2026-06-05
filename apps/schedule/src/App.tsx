import { useState } from 'react';
import { Layout } from './components/Layout';
import { WeldingSchedulePage } from './pages/WeldingSchedulePage';
import { JobHistoryPage } from './pages/JobHistoryPage';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminModeProvider } from './context/AdminModeContext';
import { SidebarProvider } from './context/SidebarContext';

function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [fileName, setFileName] = useState<string>('');
  const [currentView, setCurrentView] = useState<'gantt' | 'history'>('gantt');

  // ファイル名から日付を抽出 (例: 1204xxx.csv -> 12月4日)
  const getDateFromFileName = (name: string): string => {
    if (!name) return '概要';

    // ファイル名から数字4桁を抽出 (MMDD形式を想定)
    const match = name.match(/^(\d{2})(\d{2})/);
    if (match) {
      const month = parseInt(match[1], 10);
      const day = parseInt(match[2], 10);
      return `${month}月${day}日`;
    }
    return '概要';
  };

  if (loading) {
    return <div className="h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout
      headerTitle={getDateFromFileName(fileName)}
      onSignOut={signOut}
    >
      {currentView === 'history' ? (
        <JobHistoryPage onBack={() => setCurrentView('gantt')} />
      ) : (
        <WeldingSchedulePage
          onFileNameChange={setFileName}
          viewMode={'gantt'}
          onNavigateToHistory={() => setCurrentView('history')}
        />
      )}
    </Layout>
  );
}

function App() {
  return (
    <SidebarProvider>
      <AuthProvider>
        <AdminModeProvider>
          <AppContent />
        </AdminModeProvider>
      </AuthProvider>
    </SidebarProvider>
  );
}

export default App;
