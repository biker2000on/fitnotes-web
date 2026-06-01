// SyncView.tsx - Account login, cloud sync, and FitNotes backup import/export.
import { RefreshCw, Upload, Download } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';

export function SyncView() {
  const {
    token, userEmail, syncStatus, triggerSync,
    importStatus, handleBackupUpload, exporting, handleBackupDownload,
    authError, authEmail, setAuthEmail, authPassword, setAuthPassword, handleAuth, handleCsvDownload,
  } = useFitNotesStore();

  return (
    <div style={{ maxWidth: '480px', margin: '40px auto 0 auto', width: '100%' }}>
      {token ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ gap: '24px', padding: '32px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', color: 'var(--primary)', margin: '0 auto' }}>
              <RefreshCw size={32} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Account Synchronization</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', marginTop: '6px' }}>Logged in as <strong style={{ color: 'var(--text-primary-dark)' }}>{userEmail}</strong></p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                className={`btn btn-primary ${syncStatus === 'syncing' ? 'loading' : ''}`}
                onClick={triggerSync}
                style={{ width: '100%', height: '46px' }}
                disabled={syncStatus === 'syncing'}
              >
                {syncStatus === 'syncing' ? 'Syncing with PostgreSQL...' : 'Sync Database Now'}
              </button>
              {syncStatus === 'success' && (
                <p style={{ color: 'var(--success)', fontSize: '13px', fontWeight: 600 }}>Sync succeeded! Data is fully updated.</p>
              )}
              {syncStatus === 'error' && (
                <p style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 600 }}>Sync failed. Check Go API server logs.</p>
              )}
            </div>

            <p style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>
              FitNotes offline-first worker automatically merges changes using our custom Last-Write-Wins conflict resolution algorithm.
            </p>
          </div>

          {/* Import FitNotes Backup Card */}
          <div className="card" style={{ gap: '20px', padding: '32px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', color: 'var(--primary)', margin: '0 auto' }}>
              <Upload size={32} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Import FitNotes Backup</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', marginTop: '6px' }}>
                Upload a native <strong>.fitnotes</strong> or <strong>.sqlite</strong> database backup file from the original FitNotes app to restore your complete history.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', width: '100%' }}>
              <label
                className={`btn btn-secondary ${importStatus === 'importing' ? 'loading' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  height: '46px',
                  cursor: importStatus === 'importing' ? 'default' : 'pointer',
                  pointerEvents: importStatus === 'importing' ? 'none' : 'auto',
                }}
              >
                {importStatus === 'importing' ? 'Importing Backup...' : 'Choose Backup File'}
                <input
                  type="file"
                  accept=".sqlite,.fitnotes"
                  onChange={handleBackupUpload}
                  style={{ display: 'none' }}
                  disabled={importStatus === 'importing'}
                />
              </label>

              {importStatus === 'success' && (
                <p style={{ color: 'var(--success)', fontSize: '13px', fontWeight: 600 }}>Import succeeded! Your history is restored and synced.</p>
              )}
              {importStatus === 'error' && (
                <p style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 600 }}>Import failed. Please verify the backup file.</p>
              )}
            </div>

            <div style={{ borderLeft: '3px solid var(--warning)', paddingLeft: '12px', textAlign: 'left', marginTop: '10px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', lineHeight: '1.4' }}>
                <strong style={{ color: 'var(--warning)' }}>Warning:</strong> This will overwrite your existing online workout history and local cached records with the backup data.
              </p>
            </div>
          </div>

          {/* Export FitNotes Backup Card */}
          <div className="card" style={{ gap: '20px', padding: '32px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', color: 'var(--primary)', margin: '0 auto' }}>
              <Download size={32} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Export FitNotes Backup</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', marginTop: '6px' }}>
                Download your entire workout logs history, custom categories, exercises, and routines as a native <strong>.fitnotes</strong> backup database file compatible with the original FitNotes mobile app.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', width: '100%' }}>
              <button
                className={`btn btn-secondary ${exporting ? 'loading' : ''}`}
                onClick={handleBackupDownload}
                style={{ width: '100%', height: '46px' }}
                disabled={exporting}
              >
                {exporting ? 'Generating Backup File...' : 'Download Backup File'}
              </button>
              <button className="btn btn-secondary" onClick={handleCsvDownload} style={{ width: '100%', height: '46px' }}>
                Export Spreadsheet (CSV)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ gap: '20px', padding: '32px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Join FitNotes Cloud</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', marginTop: '4px' }}>Log in to sync your local data seamlessly across devices.</p>
          </div>

          {authError && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', padding: '12px', borderRadius: '10px', color: 'var(--danger)', fontSize: '13px', fontWeight: 600 }}>
              {authError}
            </div>
          )}

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleAuth('login');
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Email Address</label>
              <input type="email" placeholder="you@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Password</label>
              <input type="password" placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Sign In</button>
              <button type="button" className="btn btn-secondary" onClick={() => handleAuth('register')} style={{ flex: 1 }}>Create Account</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
