import { useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';

interface APIKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  access_mode: 'read_only';
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

interface CreatedAPIKey extends APIKeyRecord {
  key: string;
}

export function ApiKeysPanel() {
  const { token, getApiBaseUrl, triggerToast } = useFitNotesStore();
  const [keys, setKeys] = useState<APIKeyRecord[]>([]);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreatedAPIKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'API key request failed');
    return data;
  };

  const loadKeys = async () => {
    if (!token) {
      setKeys([]);
      setListError('');
      return;
    }
    setListLoading(true);
    setListError('');
    try {
      const data = await request('/api/api-keys');
      setKeys(data.api_keys ?? []);
    } catch (error) {
      console.warn('Failed to load API keys:', error);
      setListError(error instanceof Error ? error.message : 'Failed to load API keys');
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, [token]);

  const createKey = async () => {
    if (!name.trim() || !token) return;
    setLoading(true);
    try {
      const data = await request('/api/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      }) as CreatedAPIKey;
      setCreated(data);
      setName('');
      await loadKeys();
      triggerToast('Read-only API key created.');
    } catch (error: any) {
      triggerToast(error.message || 'Failed to create API key', 'error');
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async (key: APIKeyRecord) => {
    if (!window.confirm(`Revoke "${key.name}"? Applications using it will immediately lose access.`)) return;
    try {
      await request(`/api/api-keys/${key.id}`, { method: 'DELETE' });
      await loadKeys();
      triggerToast('API key revoked.');
    } catch (error: any) {
      triggerToast(error.message || 'Failed to revoke API key', 'error');
    }
  };

  const copySecret = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.key);
    triggerToast('API key copied.');
  };

  if (!token) {
    return (
      <div style={{ padding: '14px 0 4px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>Read-only API keys</div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', marginTop: '3px' }}>
          Sign in through the Sync Center to create integration keys.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 0 4px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <KeyRound size={18} color="var(--primary)" />
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>Read-only API keys</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>
            Access versioned workout, exercise, and body-weight endpoints. Keys cannot modify data.
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="api-key-name" style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '5px' }}>
          Integration name
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            id="api-key-name"
            value={name}
            onChange={event => setName(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') createKey(); }}
            maxLength={100}
            placeholder="Home dashboard"
            style={{ flex: '1 1 220px', padding: '8px' }}
          />
          <button className="btn btn-primary" onClick={createKey} disabled={loading || !name.trim()} style={{ padding: '8px 12px' }}>
            <Plus size={15} /> {loading ? 'Creating…' : 'Create key'}
          </button>
        </div>
      </div>

      {created && (
        <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.35)' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--success)', marginBottom: '6px' }}>
            Copy this key now—it will not be shown again.
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <code style={{ flex: 1, overflowWrap: 'anywhere', fontSize: '11px', userSelect: 'all' }}>{created.key}</code>
            <button className="btn btn-secondary" onClick={copySecret} style={{ padding: '7px 10px' }}><Copy size={14} /> Copy</button>
          </div>
          <button className="btn btn-secondary" onClick={() => setCreated(null)} style={{ padding: '5px 9px', fontSize: '10px', marginTop: '8px' }}>I saved it</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {listLoading ? (
          <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>Loading API keys…</div>
        ) : listError ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--danger)' }}>{listError}</span>
            <button className="btn btn-secondary" onClick={loadKeys} style={{ padding: '5px 9px', fontSize: '10px' }}>Retry</button>
          </div>
        ) : keys.filter(key => !key.revoked_at).length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>No active API keys.</div>
        ) : keys.filter(key => !key.revoked_at).map(key => (
          <div key={key.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{key.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary-dark)' }}>
                {key.key_prefix}… · read only · created {new Date(key.created_at).toLocaleDateString()}
                {key.last_used_at ? ` · last used ${new Date(key.last_used_at).toLocaleString()}` : ' · never used'}
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => revokeKey(key)}
              title="Revoke API key"
              aria-label={`Revoke API key ${key.name}`}
              style={{ padding: '7px 9px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.35)' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '10px', color: 'var(--text-secondary-dark)', lineHeight: 1.5 }}>
        Send the key as <code>Authorization: Bearer fn_ro_…</code> or <code>X-API-Key</code> to <code>{getApiBaseUrl()}/api/v1/</code>.
      </div>
    </div>
  );
}
