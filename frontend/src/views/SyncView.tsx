// SyncView.tsx - Account login, cloud sync, and FitNotes backup import/export.
import { useState, useEffect } from 'react';
import { RefreshCw, Upload, Download, Globe, KeyRound } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { isTauri } from '../storage/db';

export function SyncView() {
  const {
    token, userEmail, syncStatus, triggerSync,
    importStatus, handleBackupUpload, exporting, handleBackupDownload,
    authError, authLoading, authEmail, setAuthEmail, authPassword, setAuthPassword, handleAuth, handleCsvDownload,
    customApiUrl, updateCustomApiUrl, getApiBaseUrl, triggerToast,
  } = useFitNotesStore();

  const [apiUrlInput, setApiUrlInput] = useState(customApiUrl);
  const [oidcProvider, setOidcProvider] = useState<string | null>(null);
  const [identity, setIdentity] = useState<{ oidc_linked: boolean; has_password: boolean; oidc_provider: string; auth_method: string } | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    setApiUrlInput(customApiUrl);
  }, [customApiUrl]);

  // Discover whether the server has an SSO provider configured.
  useEffect(() => {
    fetch(`${getApiBaseUrl()}/api/auth/providers`)
      .then(res => (res.ok ? res.json() : {}))
      .then((data: { oidc?: { name?: string } }) => setOidcProvider(data?.oidc?.name ?? null))
      .catch(() => setOidcProvider(null));
  }, [customApiUrl]);

  // Identity / link status for the signed-in account.
  const loadIdentity = () => {
    if (!token) {
      setIdentity(null);
      return;
    }
    fetch(`${getApiBaseUrl()}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : null))
      .then(data => setIdentity(data))
      .catch(() => setIdentity(null));
  };
  useEffect(loadIdentity, [token, customApiUrl]);

  // Web: navigate the SPA through the redirect flow. Mobile: passkeys don't
  // work in the embedded WebView, so launch the system browser; the backend
  // callback returns the session via the fitnotes:// deep link.
  const startOidcFlow = async (linkToken?: string) => {
    const params = new URLSearchParams();
    if (isTauri()) params.set('client', 'mobile');
    if (linkToken) params.set('link_token', linkToken);
    const qs = params.toString();
    const url = `${getApiBaseUrl()}/api/auth/oidc/login${qs ? `?${qs}` : ''}`;
    if (isTauri()) {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(url);
      } catch (e) {
        triggerToast('Failed to open the browser for sign-on', 'error');
        console.warn('opener failed:', e);
      }
    } else {
      window.location.href = url;
    }
  };

  const handleUnlink = async () => {
    if (!token) return;
    setUnlinking(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/oidc/unlink`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to unlink');
      triggerToast('Single sign-on identity unlinked.');
      loadIdentity();
    } catch (e: any) {
      triggerToast(e.message || 'Failed to unlink', 'error');
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div style={{ marginTop: '24px', width: '100%' }}>
      {/* API Server Endpoint Override Widget */}
      <div className="card" style={{ gap: '16px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <Globe size={18} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>API Server Endpoint</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', margin: '2px 0 0 0' }}>
              Override default API URL for mobile or network debugging.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="e.g. http://192.168.1.50:8080"
              value={apiUrlInput}
              onChange={(e) => setApiUrlInput(e.target.value)}
              style={{ flex: 1, height: '38px', fontSize: '13px' }}
            />
            <button
              className="btn btn-primary"
              onClick={() => {
                updateCustomApiUrl(apiUrlInput);
              }}
              style={{ padding: '0 16px', height: '38px', fontSize: '13px' }}
            >
              Save
            </button>
            {customApiUrl && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  updateCustomApiUrl('');
                  setApiUrlInput('');
                }}
                style={{ padding: '0 12px', height: '38px', fontSize: '13px' }}
              >
                Reset
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ color: 'var(--text-secondary-dark)' }}>Active Target API:</span>
            <code style={{ color: 'var(--primary)', fontWeight: 600 }}>{getApiBaseUrl()}</code>
          </div>

          <div style={{ fontSize: '10px', color: 'var(--text-secondary-dark)', textAlign: 'left', lineHeight: '1.4', borderLeft: '2px solid var(--primary)', paddingLeft: '8px' }}>
            <strong>Note for Mobile (Android):</strong> <code>localhost</code> points to the phone. To sync with a local server, use your PC's Wi-Fi IP (e.g. <code>http://192.168.1.XX:8080</code>). Ensure the Go server is bound to <code>0.0.0.0</code>.
          </div>
        </div>
      </div>
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
                onClick={() => triggerSync()}
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

          {/* Single Sign-On Identity Card */}
          {oidcProvider && identity && (
            <div className="card" style={{ gap: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                  <KeyRound size={18} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>{identity.oidc_provider || oidcProvider}</h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', margin: '2px 0 0 0' }}>
                    {identity.oidc_linked
                      ? `Linked - you can sign in with ${identity.oidc_provider || oidcProvider}`
                      : 'Link your account to sign in with single sign-on'}
                  </p>
                </div>
                {identity.oidc_linked ? (
                  <button
                    className="btn btn-secondary"
                    onClick={handleUnlink}
                    disabled={unlinking || !identity.has_password}
                    title={!identity.has_password ? 'This account has no password - unlinking would lock you out' : undefined}
                    style={{ fontSize: '12px', padding: '8px 14px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                  >
                    {unlinking ? 'Unlinking...' : 'Unlink'}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '12px', padding: '8px 14px' }}
                    onClick={() => startOidcFlow(token)}
                  >
                    Link {oidcProvider}
                  </button>
                )}
              </div>
            </div>
          )}

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
              <input type="email" placeholder="you@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} disabled={authLoading} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Password</label>
              <input type="password" placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button type="submit" className={`btn btn-primary ${authLoading ? 'loading' : ''}`} disabled={authLoading} style={{ flex: 1 }}>
                {authLoading && syncStatus === 'syncing' ? 'Loading Data...' : authLoading ? 'Signing In...' : 'Sign In'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => handleAuth('register')} disabled={authLoading} style={{ flex: 1 }}>Create Account</button>
            </div>
          </form>

          {oidcProvider && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ flex: 1, height: '1px', background: 'var(--border-dark)' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>or</span>
                <span style={{ flex: 1, height: '1px', background: 'var(--border-dark)' }} />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => startOidcFlow()}
              >
                <KeyRound size={16} /> Sign in with {oidcProvider}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
