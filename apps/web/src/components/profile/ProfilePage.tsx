import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Building2, Shield, Save, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../store/authStore';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';
import { Spinner } from '../shared/Spinner';


export function ProfilePage() {
  const u = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const t = useI18n((s) => s.t);
  const [name, setName] = useState(u.name);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api('/auth/me', { method: 'PATCH', body: JSON.stringify({ name }) });
      setSuccess(t('profile.saved'));
    } catch (err: any) {
      setError(err.message || t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const initials = u.name.split(' ').map((w: any) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> {t('profile.title')}</div>
          <h1>{t('profile.title')}</h1>
          <p>{t('profile.subtitle')}</p>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 560 }}>
        <div style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
            <div className="avatar-green" style={{ width: 64, height: 64, fontSize: 22, borderRadius: 16 }}>
              {initials}
            </div>
            <div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{u.name}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{u.email}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {u.roles.map((r: any) => (
                  <span key={r} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: r === 'ADMINISTRATOR' ? '#eff6ff' : r === 'RESPONSABLE' ? '#f5f3ff' : '#f1f5f9', color: r === 'ADMINISTRATOR' ? '#2563eb' : r === 'RESPONSABLE' ? '#7c3aed' : '#334155' }}>
                    {t(`roles.${r}` as any) || r}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {success && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 10, marginBottom: 20, color: '#2563eb', fontSize: 14 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              {success}
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, marginBottom: 20, color: '#b91c1c', fontSize: 14 }}>
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSave}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{t('profile.name')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#f1f5f9', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <User size={16} color="#64748b" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: '#0f172a', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{t('settings.email')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#f1f5f9', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <Mail size={16} color="#64748b" />
                  <span style={{ fontSize: 14, color: '#64748b' }}>{u.email}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{t('settings.organization')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#f1f5f9', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <Building2 size={16} color="#64748b" />
                  <span style={{ fontSize: 14, color: '#64748b' }}>{u.organizationName}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{t('settings.role')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#f1f5f9', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <Shield size={16} color="#64748b" />
                  <span style={{ fontSize: 14, color: '#64748b' }}>{t(`roles.${u.roles[0]}` as any) || u.roles[0]}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 28, display: 'flex', gap: 10 }}>
              {/* Disable submit when name unchanged or while saving */}
              <button type="submit" className="button button-primary" disabled={saving || name === u.name}>
                {saving ? <Spinner size={14} /> : <><Save size={15} /> {t('profile.save')}</>}
              </button>
              <button type="button" className="button button-outline" onClick={() => nav('/')}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
