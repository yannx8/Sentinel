import { useState } from 'react';
import { User, Bell, Shield, Globe, Palette, ChevronRight, Save } from 'lucide-react';
import { useAuth } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { Toast } from '../shared/Toast';

const settingsSections = [
  {
    titleKey: 'settings.account',
    items: [
      { icon: User, labelKey: 'settings.profile', descKey: 'settings.profileDesc' },
      { icon: Bell, labelKey: 'settings.notifications', descKey: 'settings.notificationsDesc' },
      { icon: Shield, labelKey: 'settings.security', descKey: 'settings.securityDesc' },
    ],
  },
  {
    titleKey: 'settings.organization',
    items: [
      { icon: Globe, labelKey: 'settings.general', descKey: 'settings.generalDesc' },
      { icon: Palette, labelKey: 'settings.appearance', descKey: 'settings.appearanceDesc' },
    ],
  },
];

export function Settings() {
  const u = useAuth((s) => s.user)!;
  const { locale, setLocale } = useI18n();
  const t = useI18n((s) => s.t);
  const [toast, setToast] = useState('');
  const initials = u.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const roleLabel: Record<string, string> = { ADMINISTRATOR: 'Admin', RESPONSABLE: 'Responsable', USER: 'User' };

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24, animation: 'page-in 0.25s ease both', maxWidth: 640 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', fontFamily: "'Manrope', sans-serif", margin: 0 }}>{t('nav.settings')}</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{t('settings.subtitle')}</p>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#2563EB', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: '#0f172a', margin: 0 }}>{u.name}</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{u.email}</p>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '3px 10px', borderRadius: 999, background: '#EFF6FF', color: '#1D4ED8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {roleLabel[u.roles[0]] || u.roles[0]}
            </span>
          </div>
        </div>
      </div>

      {settingsSections.map((section) => (
        <div key={section.titleKey}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{t(section.titleKey)}</h2>
          <div className="card" style={{ overflow: 'hidden' }}>
            {section.items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.labelKey}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderBottom: i < section.items.length - 1 ? '1px solid #f1f5f9' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ width: 36, height: 36, background: '#f1f5f9', borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon size={18} color="#64748b" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', margin: 0 }}>{t(item.labelKey)}</p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{t(item.descKey)}</p>
                  </div>
                  <ChevronRight size={16} color="#94A3B8" />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{t('settings.language')}</h2>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['en', 'fr'] as const).map((l) => (
              <button
                key={l}
                onClick={() => { setLocale(l); setToast(t('settings.saved')); }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                  border: locale === l ? '2px solid #2563EB' : '1px solid #e2e8f0',
                  borderRadius: 10, background: locale === l ? '#f0f7ff' : '#fff',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  color: locale === l ? '#2563EB' : '#475569', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 20 }}>{l === 'en' ? '\uD83C\uDDFA\uD83C\uDDF8' : '\uD83C\uDDEB\uD83C\uDDF7'}</span>
                {l === 'en' ? 'English' : 'Fran\u00e7ais'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

export { Settings as SettingsPage };
