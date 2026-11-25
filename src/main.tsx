import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { BackupApp } from './app/BackupApp';
import { isVer2, usePath } from './app/navigation';
import { ReportsPage } from './app/ReportsPage';
import { Ver2App } from './app/Ver2App';
import './styles/global.css';
import './styles/v3.css';
import './styles/ver2.css';
import './styles/backup.css';

declare global {
  interface Window {
    __NURSING_SCREEN__?: 'ver1' | 'ver2'
  }
}

function isBackup(path: string) {
  return path === '/backup' || path.startsWith('/backup/');
}

function isReports(path: string) {
  return path === '/reports' || path.startsWith('/reports/');
}

function Root() {
  const path = usePath();
  const screen = window.__NURSING_SCREEN__;
  if (!screen && isBackup(path)) return <BackupApp />;
  if (!screen && isReports(path)) return <ReportsPage />;
  if (screen === 'ver2' || (!screen && isVer2(path))) return <Ver2App />;
  return <App />;
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
