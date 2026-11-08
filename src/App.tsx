import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { UserProvider } from './context/UserContext';
import { QueueProvider } from './context/QueueContext';
import { PlayerProvider } from './context/PlayerContext';
import { DataUsageProvider } from './context/DataUsageContext';
import { AppShell } from './components/layout/AppShell';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <UserProvider>
        <QueueProvider>
          <PlayerProvider>
            <DataUsageProvider>
              <AppShell />
            </DataUsageProvider>
          </PlayerProvider>
        </QueueProvider>
      </UserProvider>
    </ThemeProvider>
  );
};

export default App;
