import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { BackupApp } from './app/BackupApp';
import { isVer2, usePath } from './app/navigation';
import { Ver2App } from './app/Ver2App';
import './styles/global.css';
import './styles/v3.css';
import './styles/ver2.css';
import './styles/backup.css';

function isBackup(path: string) {
  return path === '/backup' || path.startsWith('/backup/');
}

function Root() {
  const path = usePath();
  if (isBackup(path)) return <BackupApp />;
  return isVer2(path) ? <Ver2App /> : <App />;
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
