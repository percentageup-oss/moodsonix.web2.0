import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { UserProvider } from './context/UserContext';
import { QueueProvider } from './context/QueueContext';
import { PlaylistProvider } from './context/PlaylistContext';
import { PlayerProvider } from './context/PlayerContext';
import { DataUsageProvider } from './context/DataUsageContext';
import { AppShell } from './components/layout/AppShell';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <UserProvider>
            <QueueProvider>
              <PlaylistProvider>
                <PlayerProvider>
                  <DataUsageProvider>
                    <AppShell />
                  </DataUsageProvider>
                </PlayerProvider>
              </PlaylistProvider>
            </QueueProvider>
          </UserProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
