import { useState, useEffect } from 'react';
import { Mail, Send, Sparkles, AlertCircle, CheckCircle2, X, Eye, Calendar, FileText, Activity, Download, User as UserIcon } from 'lucide-react';
import { USMLERow } from '../types';
import { AutomationSettings, DEFAULT_AUTOMATION_SETTINGS, runSystemDiagnostics, dispatchAutomations } from '../services/workspaceAutomations';
import { subscribeToAuth, googleSignIn, googleSignOut } from '../services/googleDrive';
import { User } from 'firebase/auth';

interface SettingsProps {
  rows: USMLERow[];
  onExport: () => void;
  onForceSync: () => void;
}

export default function Settings({ rows, onExport, onForceSync }: SettingsProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // Email states
  const [recipientEmail, setRecipientEmail] = useState('dhirencanada@gmail.com');
  const [isSending, setIsSending] = useState(false);
  const [digestResponse, setDigestResponse] = useState<any | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [emailSuccessToast, setEmailSuccessToast] = useState<string | null>(null);

  // Automations Hub State
  const [settings, setSettings] = useState<AutomationSettings>(() => {
    try {
      const stored = localStorage.getItem('automation_settings');
      return stored ? JSON.parse(stored) : DEFAULT_AUTOMATION_SETTINGS;
    } catch {
      return DEFAULT_AUTOMATION_SETTINGS;
    }
  });

  const [isHealthy, setIsHealthy] = useState(true);

  useEffect(() => {
    localStorage.setItem('automation_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    // Run an initial health check on a mock question or the latest row to drive the UI visually.
    const latestRow = rows.length > 0 ? rows[rows.length - 1] : { qid: '123', system: 'Cardio', attempt1: 'Correct' };
    const diag = runSystemDiagnostics(latestRow as any);
    setIsHealthy(diag.is_healthy);
  }, [rows]);

  const toggleSetting = (key: keyof AutomationSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [testOutput, setTestOutput] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const runIntegrationTest = async () => {
    setIsTesting(true);
    setTestOutput(null);
    try {
      // Find a mock row or the latest row
      const latestRow = rows.length > 0 ? rows[rows.length - 1] : { 
        qid: '4021', 
        system: 'Cardiovascular System', 
        attempt1: 'Incorrect',
        studyGuide: 'Aortic dissection presents with tearing chest pain radiating to the back.'
      };

      const todayStr = new Date().toLocaleDateString('en-CA');
      const currentDailyCount = rows.filter(r => r.date === todayStr && (r.attempt1 !== '' || r.attempt2 !== '')).length;
      
      const result = await dispatchAutomations(latestRow as any, 65, currentDailyCount, settings);
      setTestOutput(result);
    } catch (e: any) {
      setTestOutput({ success: false, error: e.message || 'Unknown error' });
    } finally {
      setIsTesting(false);
    }
  };

  // Auto clean up email success toast
  useEffect(() => {
    if (emailSuccessToast) {
      const t = setTimeout(() => setEmailSuccessToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [emailSuccessToast]);

  // Diagnostic Logs state
  const [deviceId, setDeviceId] = useState('');
  const [syncLogs, setSyncLogs] = useState<any[]>([]);

  useEffect(() => {
    const dId = localStorage.getItem('ck_device_id') || 'Unknown';
    setDeviceId(dId);

    const loadLogs = () => {
      try {
        setSyncLogs(JSON.parse(localStorage.getItem('ck_sync_logs') || '[]'));
      } catch (e) {}
    }
    loadLogs();

    window.addEventListener('ck_sync_logs_updated', loadLogs);
    return () => window.removeEventListener('ck_sync_logs_updated', loadLogs);
  }, []);

  const handleTriggerEmailDigest = async (targetRange: 'yesterday' | 'today') => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }

    setIsSending(true);
    try {
      let targetDateStr = '';
      if (targetRange === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        targetDateStr = yesterday.toLocaleDateString('en-CA');
      } else {
        targetDateStr = new Date().toLocaleDateString('en-CA');
      }

      const response = await fetch('/api/send-email-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recipientEmail,
          rows: rows,
          targetDate: targetDateStr
        })
      });

      const data = await response.json();
      if (data.success) {
        setDigestResponse(data);
        const digest = data.digestResult;
        if (digest?.realMail) {
          setEmailSuccessToast(`Real email digest successfully sent to ${recipientEmail}! Check your inbox.`);
        } else if (digest?.error) {
          setEmailSuccessToast(`⚠️ SMTP Send Failed: ${digest.error}. App rendered the virtual mock study digest below instead.`);
        } else {
          setEmailSuccessToast(`Success! Generated mock study digest for ${recipientEmail}. Setup SMTP / Gmail credentials inside your .env configuration to dispatch real email alerts.`);
        }
      } else {
        alert(`Error: ${data.error || 'Failed generating email digest.'}`);
      }
    } catch (err: any) {
      console.error(err);
      alert('Network error compiling study digest server-side.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-8 flex-1 bg-[#F2F2F7]">
      <h2 className="text-xl font-medium tracking-wide text-[#1C1C1E] mb-6 ">System Settings</h2>

      {/* Toast Alert Inside Comp */}
      {emailSuccessToast && (
        <div className={`mb-6 p-3 border text-xs rounded-2xl max-w-2xl flex items-center gap-2 animate-fade-in ${
          emailSuccessToast.startsWith('⚠️')
            ? 'bg-[#F2F2F7] border-[#FF8D28] text-[#FF8D28]' 
            : 'bg-[#F2F2F7] border-transparent text-[#34C759]'
        }`}>
          {emailSuccessToast.startsWith('⚠️') ? (
            <AlertCircle size={14} className="text-[#FF8D28] shrink-0" />
          ) : (
            <CheckCircle2 size={14} className="text-[#34C759] shrink-0" />
          )}
          <span className="flex-1 font-medium">{emailSuccessToast}</span>
          <button onClick={() => setEmailSuccessToast(null)} className="text-[#1C1C1E] hover:text-[#1C1C1E] font-medium tracking-wide px-1 text-sm">×</button>
        </div>
      )}

      <div className="flex flex-col gap-6">

        {/* Data & Synchronization Block */}
        <div className="bg-[#FFFFFF] border border-[#F2F2F7] rounded-2xl p-5 md:p-6 shadow-sm max-w-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Download size={20} className="text-[#0088FF]" />
              <h3 className="text-lg  font-medium tracking-wide text-[#1C1C1E] tracking-tight">
                Data & Synchronization
              </h3>
            </div>
            
            <p className="text-sm text-[#1C1C1E] leading-relaxed mb-5">
              Securely export your UWorld database locally or force a manual synchronization of your data.
            </p>

            <div className="flex flex-col gap-3">
              <div className="bg-[#F2F2F7] p-4 border border-[#F2F2F7] rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium tracking-wide text-[#1C1C1E] block">Cloud Sync (Google Drive)</span>
                    <span className="text-[11px] text-[#1C1C1E] mt-0.5 block">Sync your tracker automatically across devices</span>
                  </div>
                  {currentUser ? (
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border shadow-sm bg-[#F2F2F7] border-[#F2F2F7] text-sm font-medium tracking-wide`}>
                        <div className="w-4 h-4 flex items-center shrink-0">
                          <svg viewBox="0 0 48 48" className="w-4 h-4">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          </svg>
                        </div>
                        <span className="truncate max-w-[150px] text-[#1C1C1E]">{currentUser.displayName || currentUser.email}</span>
                        <CheckCircle2 size={14} className="text-[#34C759] ml-1" />
                      </div>
                      <button
                        onClick={googleSignOut}
                        className="flex items-center gap-2 bg-[#FF383C]/10 text-[#FF383C] px-3 py-1.5 rounded-2xl text-xs font-medium tracking-wide hover:bg-[#FF383C]/20 transition-colors shadow-sm cursor-pointer border border-transparent hover:border-[#FF383C]/30"
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={googleSignIn}
                      className="flex items-center gap-2 bg-[#FFFFFF] text-[#1C1C1E] px-4 py-2 rounded-2xl text-xs font-medium tracking-wide hover:bg-[#F2F2F7] transition-colors shadow-sm cursor-pointer"
                    >
                      Sign in with Google
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-[#F2F2F7] p-4 border border-[#F2F2F7] rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium tracking-wide text-[#1C1C1E] block">Export as CSV</span>
                    <span className="text-[11px] text-[#1C1C1E] mt-0.5 block">Download a backup of all question data</span>
                  </div>
                  <button
                    onClick={onExport}
                    className="flex items-center justify-center gap-1.5 bg-[#F2F2F7] hover:bg-[#F2F2F7] text-[#1C1C1E] px-4 py-2 rounded-2xl text-xs font-medium tracking-wide border border-[#F2F2F7] transition-colors shadow-md cursor-pointer"
                  >
                    <Download size={14} className="text-[#1C1C1E]" />
                    Export Data
                  </button>
                </div>
              </div>

              <div className="bg-[#F2F2F7] p-4 border border-[#F2F2F7] rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium tracking-wide text-[#1C1C1E] block">Force Manual Sync</span>
                    <span className="text-[11px] text-[#1C1C1E] mt-0.5 block">Push local device state to cloud immediately</span>
                  </div>
                  <button
                    onClick={onForceSync}
                    disabled={!currentUser}
                    className="flex items-center justify-center gap-1.5 bg-[#0088FF] hover:bg-[#0077E6] text-[#FFFFFF] px-4 py-2 rounded-2xl text-xs font-medium tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md cursor-pointer"
                  >
                    <Activity size={14} className="text-[#FFFFFF]" />
                    <span className="text-[#FFFFFF]">Push to Cloud</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic Logs Block */}
        <div className="bg-[#FFFFFF] border border-[#F2F2F7] rounded-2xl p-5 md:p-6 shadow-sm max-w-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle size={20} className="text-[#FF8D28]" />
              <h3 className="text-lg font-medium tracking-wide text-[#1C1C1E] tracking-tight">
                Diagnostic Sync Logs
              </h3>
            </div>
            
            <p className="text-sm text-[#1C1C1E] leading-relaxed mb-5">
              Review recent cloud synchronization events and device identity strings to help diagnose duplicate conflict sequences or stale data reads.
            </p>

            <div className="bg-[#F2F2F7] p-4 border border-[#F2F2F7] rounded-2xl overflow-hidden">
               <div className="flex items-center justify-between mb-4">
                 <span className="text-xs font-semibold tracking-wide text-[#1C1C1E] block">Device Client Identifier</span>
                 <span className="text-[11px] font-mono text-[#0088FF] bg-[#0088FF]/10 px-2 py-0.5 rounded-lg">{deviceId}</span>
               </div>
               <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-[#1C1C1E] block mb-1">Recent Synchronization Activity</span>
                  {syncLogs.length === 0 ? (
                    <span className="text-xs text-[#8E8E93] italic block pt-2 border-t border-[#FFFFFF]">No synchronization logs recorded yet...</span>
                  ) : syncLogs.map((log, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-t border-[#FFFFFF] gap-1">
                      <span className="text-[11px] text-[#1C1C1E] font-medium opacity-80">{new Date(log.timestamp).toLocaleString()}</span>
                      <span className="text-[11px] text-[#0088FF] font-medium bg-[#FFFFFF] px-2 py-1 rounded shadow-sm border border-[#F2F2F7]">{log.method} <span className="opacity-50 text-[10px] ml-1">({log.deviceId})</span></span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
        
        {/* Email Digest Settings Block */}
        <div className="bg-[#FFFFFF] border border-[#F2F2F7] rounded-2xl p-5 md:p-6 shadow-sm max-w-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Mail size={20} className="text-[#0088FF]" />
              <h3 className="text-lg  font-medium tracking-wide text-[#1C1C1E] tracking-tight">
                Daily Notification Digest
              </h3>
            </div>
            
            <p className="text-sm text-[#1C1C1E] leading-relaxed mb-5">
              Get an automated email digest every morning detailing questions completed yesterday, accuracy ratings, focus areas, and clinical takeaways! Configure SMTP settings via your cloud provider (.env overrides) for automated daily digests to work correctly.
            </p>

            <div className="bg-[#F2F2F7] p-4 border border-[#F2F2F7] rounded-2xl">
              <label className="block text-[10px]  text-[#1C1C1E] uppercase tracking-wider mb-2 font-medium tracking-wide">
                Delivery Email Address
              </label>
              <div className="relative mb-4">
                <input
                  type="email"
                  placeholder="e.g. medical@student.com"
                  className="w-full pl-9 pr-3 py-2 border border-[#F2F2F7] rounded-2xl bg-[#FFFFFF] text-[#1C1C1E] text-sm focus:ring-1 focus:ring-[#0088FF] focus:border-[#0088FF] outline-none transition-all "
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1C1C1E]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => handleTriggerEmailDigest('yesterday')}
                  className="px-4 py-2.5 bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-[#0088FF] hover:border-[#0088FF] text-[#0088FF] rounded-2xl hover:text-[#1C1C1E] transition-all text-sm font-medium tracking-wide cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  title="Deliver a digest summary of yesterday's studies"
                >
                  <Send size={14} className="shrink-0" />
                  <span>{isSending ? 'Sending...' : 'Mail Yesterday'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => handleTriggerEmailDigest('today')}
                  className="px-4 py-2.5 bg-[#F2F2F7] border border-[#F2F2F7] text-[#1C1C1E] hover:bg-[#F2F2F7] hover:text-[#1C1C1E] rounded-2xl transition-all text-sm font-medium tracking-wide cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  title="Generate/trigger a digest on today's active questions"
                >
                  <Sparkles size={14} className="shrink-0 text-[#FF8D28]" />
                  <span>Test Live Stats</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Quick Preview Links */}
          <div className="mt-5 pt-4 border-t border-[#F2F2F7] flex items-center justify-between">
            {digestResponse ? (
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="text-sm text-[#0088FF] hover:text-[#0088FF] flex items-center gap-1.5 font-medium tracking-wide cursor-pointer"
              >
                <Eye size={14} /> View Last Generated Email Draft
              </button>
            ) : (
               <span className="text-xs text-[#AEAEB2]  italic">No cached dispatch generated yet relative to page load.</span>
            )}
          </div>
        </div>

        {/* Automations & Integrations Hub */}
        <div className="bg-[#FFFFFF] border border-[#F2F2F7] rounded-2xl max-w-2xl overflow-hidden shadow-sm mt-4">
          <div className="px-6 py-5 border-b border-[#F2F2F7] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#F2F2F7] p-2 rounded-lg border border-[#0088FF]">
                <Sparkles size={18} className="text-[#0088FF]" />
              </div>
              <div>
                <h3 className="text-lg  font-medium tracking-wide text-[#1C1C1E] tracking-tight">
                  Automations & Integrations Hub
                </h3>
                <p className="text-xs text-[#1C1C1E] mt-0.5">Google Workspace Payload Generators</p>
              </div>
            </div>
            
            {/* Diagnostic Health Check Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium tracking-wide shadow-sm ${
              isHealthy ? 'bg-[#34C759] border-transparent text-[#34C759]' : 'bg-[#FF383C] border-[#FF383C] text-[#FF383C]'
            }`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${isHealthy ? 'bg-[#34C759] shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-[#FF383C] shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`} />
              <span>{isHealthy ? 'System Health: Active' : 'System Health: Blocked'}</span>
            </div>
          </div>

          <div className="p-6 flex flex-col gap-5">
            {/* INSTRUCTIONS TO SETUP OAUTH */}
            <div className="text-[11px] text-[#1C1C1E] bg-[#FFFFFF] p-4 border border-[#F2F2F7] rounded-2xl leading-relaxed whitespace-pre-wrap">
              <strong>Developer Note - Google Workspace Authentication:</strong>
              <br />
              To execute these payloads against live user accounts, you must initialize Google OAuth 2.0. Generate a Client ID in your Google Cloud Console, request the following scopes, and execute the generated payload JSONs directly against the REST APIs.
              <br/><br/>
              <em>Required Scopes:</em> <code>https://www.googleapis.com/auth/tasks</code>, <code>https://www.googleapis.com/auth/calendar.events</code>, <code>https://www.googleapis.com/auth/keep</code>
            </div>

            {/* Google Tasks Engine */}
            <div className="bg-[#F2F2F7] border border-[#F2F2F7] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 size={18} className="text-[#0088FF]" />
                <h4 className="text-sm font-medium tracking-wide text-[#1C1C1E]">The Accountability Engine (Google Tasks)</h4>
              </div>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs text-[#1C1C1E] font-medium group-hover:text-[#1C1C1E] transition-colors">Enable Daily Quota Phasing</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings.tasksEnableDailyQuota} onChange={() => toggleSetting('tasksEnableDailyQuota')} />
                    <div className="w-9 h-5 bg-[#F2F2F7] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#34C759] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#FFFFFF] after:border-[#1C1C1E] after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </div>
                </label>
                <div className="h-[1px] w-full bg-[#F2F2F7]" />
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs text-[#1C1C1E] font-medium group-hover:text-[#1C1C1E] transition-colors">Force Anki Directives for Incorrects</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings.tasksForceAnki} onChange={() => toggleSetting('tasksForceAnki')} />
                    <div className="w-9 h-5 bg-[#F2F2F7] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#34C759] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#FFFFFF] after:border-[#1C1C1E] after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </div>
                </label>
              </div>
            </div>

            {/* Google Calendar Engine */}
            <div className="bg-[#F2F2F7] border border-[#F2F2F7] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <Calendar size={18} className="text-[#0088FF]" />
                <h4 className="text-sm font-medium tracking-wide text-[#1C1C1E]">Dynamic Scheduling (Google Calendar)</h4>
              </div>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs text-[#1C1C1E] font-medium group-hover:text-[#1C1C1E] transition-colors">Auto-Schedule Weakness Reviews (System {"<"}70%)</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings.calendarAutoScheduleWeakness} onChange={() => toggleSetting('calendarAutoScheduleWeakness')} />
                    <div className="w-9 h-5 bg-[#F2F2F7] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#34C759] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#FFFFFF] after:border-[#1C1C1E] after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </div>
                </label>
                <div className="h-[1px] w-full bg-[#F2F2F7]" />
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs text-[#1C1C1E] font-medium group-hover:text-[#1C1C1E] transition-colors">Protect Spaced Repetition Time (3 & 7 day blocks)</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings.calendarProtectSpacedRepetition} onChange={() => toggleSetting('calendarProtectSpacedRepetition')} />
                    <div className="w-9 h-5 bg-[#F2F2F7] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#34C759] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#FFFFFF] after:border-[#1C1C1E] after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </div>
                </label>
              </div>
            </div>

            {/* Google Keep Compiler */}
            <div className="bg-[#F2F2F7] border border-[#F2F2F7] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <FileText size={18} className="text-[#FF8D28]" />
                <h4 className="text-sm font-medium tracking-wide text-[#1C1C1E]">The High-Yield Compiler (Google Keep / Docs)</h4>
              </div>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs text-[#1C1C1E] font-medium group-hover:text-[#1C1C1E] transition-colors">Auto-Compile Clinical Pearls to Study Guide</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings.keepAutoCompilePearls} onChange={() => toggleSetting('keepAutoCompilePearls')} />
                    <div className="w-9 h-5 bg-[#F2F2F7] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#34C759] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#FFFFFF] after:border-[#1C1C1E] after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </div>
                </label>
              </div>
            </div>

            {/* Integration Testing */}
            <div className="bg-[#F2F2F7] border border-[#F2F2F7] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <Activity size={18} className="text-[#FF383C]" />
                <h4 className="text-sm font-medium tracking-wide text-[#1C1C1E]">Integration Testing (Dry Run)</h4>
              </div>
              <p className="text-xs text-[#1C1C1E] mb-4">Simulate a sync event using the most recently logged question to verify payload structures before sending to Google APIs.</p>
              
              <button 
                onClick={runIntegrationTest}
                disabled={isTesting}
                className="w-full sm:w-auto px-4 py-2 bg-[#F2F2F7] hover:bg-[#F2F2F7] border border-[#F2F2F7] hover:border-[#1C1C1E] text-[#1C1C1E] text-sm font-medium tracking-wide rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isTesting ? 'Running Diagnostics...' : '▶ Run Payload Test'}
              </button>

              {testOutput && (
                <div className="mt-4 bg-[#F2F2F7] border border-[#F2F2F7] rounded-lg p-4 overflow-hidden relative">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#F2F2F7]">
                    <span className="text-[10px] uppercase font-medium tracking-wide text-[#1C1C1E] tracking-wider">Generated Payload</span>
                    {testOutput.success ? (
                      <span className="text-[10px] font-medium tracking-wide text-[#34C759] bg-[#34C759] px-2 py-0.5 rounded">Success</span>
                    ) : (
                      <span className="text-[10px] font-medium tracking-wide text-[#FF383C] bg-[#FF383C] px-2 py-0.5 rounded">Error</span>
                    )}
                  </div>
                  <pre className="text-xs  text-[#1C1C1E] overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {JSON.stringify(testOutput.payloads || testOutput.errors || testOutput, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Google Apps Script Integration */}
            <div className="bg-[#F2F2F7] border border-[#F2F2F7] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-3">
                   <div className="bg-[#F2F2F7] p-1.5 rounded-lg border border-transparent">
                     <FileText size={16} className="text-[#34C759]" />
                   </div>
                   <h4 className="text-sm font-medium tracking-wide text-[#1C1C1E]">Google Apps Script Web App</h4>
                 </div>
              </div>
              <p className="text-xs text-[#1C1C1E] mb-4">Copy this code into <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-[#0088FF] hover:underline">script.google.com</a>, add the Tasks and Calendar services, and deploy as a Web App to process the payloads above.</p>
              
              <div className="mb-4">
                <label className="block text-xs font-medium tracking-wide text-[#1C1C1E] mb-1.5">Web App Webhook URL</label>
                <input 
                  type="text" 
                  placeholder="https://script.google.com/macros/s/..." 
                  value={settings.appsScriptWebhookUrl || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, appsScriptWebhookUrl: e.target.value }))}
                  className="w-full bg-[#F2F2F7] border border-[#F2F2F7] rounded-lg px-3 py-2 text-sm text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none focus:border-[#0088FF] transition-colors"
                />
              </div>

              <div className="bg-[#F2F2F7] rounded-lg border border-[#F2F2F7] overflow-hidden">
                <div className="bg-[#F2F2F7] px-4 py-2 border-b border-[#F2F2F7] flex justify-between items-center">
                   <span className="text-xs  text-[#1C1C1E]">Code.gs</span>
                </div>
                <pre className="p-4 text-[11px]  whitespace-pre-wrap text-[#1C1C1E] overflow-y-auto max-h-64 selection:bg-[#0088FF]">
{`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var payloads = data.payloads;
    
    // 1. Google Tasks: The Accountability Engine
    if (payloads.tasks) {
      var calendar = CalendarApp.getDefaultCalendar();
      var now = new Date();
      var endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      
      // Sweep and clear all upcoming automated macros for today before updating
      var upcomingEvents = calendar.getEvents(now, endOfDay);
      for (var e = 0; e < upcomingEvents.length; e++) {
         if (upcomingEvents[e].getDescription().indexOf("Automated macro from Tracker") !== -1) {
             upcomingEvents[e].deleteEvent();
         }
      }

      var taskListId = '@default';
      for (var i = 0; i < payloads.tasks.length; i++) {
        var t = payloads.tasks[i];
        
        if (t.scheduled_time) {
          // Route exact time tasks to Google Calendar
          var timeParts = t.scheduled_time.split(':');
          
          var startDate = new Date();
          startDate.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0, 0);
          
          // 15 minute reminder event
          var endDate = new Date(startDate.getTime() + (15 * 60000)); 

          var event = calendar.createEvent(t.task_title, startDate, endDate, {
            description: "Automated macro from Tracker."
          });
          event.addPopupReminder(10);
          event.addEmailReminder(0);
        } else {
          var task = {
            title: t.task_title,
            notes: "Automated macro from Tracker.",
            due: new Date().toISOString()
          };
          Tasks.Tasks.insert(task, taskListId);
        }
      }
    }
    
    // 2. Google Calendar: Dynamic Scheduling
    if (payloads.calendar && payloads.calendar.length > 0) {
      var calendar = CalendarApp.getDefaultCalendar();
      for (var j = 0; j < payloads.calendar.length; j++) {
        var c = payloads.calendar[j];
        
        var startDate = new Date();
        startDate.setDate(startDate.getDate() + c.days_in_future);
        var endDate = new Date(startDate.getTime() + (c.duration_minutes * 60000));
        
        var event = calendar.createEvent(c.event_title, startDate, endDate, {
          description: c.description
        });
        event.addPopupReminder(10);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({"success": true}))
        .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"success": false, "error": err.toString()}))
        .setMimeType(ContentService.MimeType.JSON);
  }
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RENDER DRAFT EMAIL PREVIEW MODAL */}
      {showPreviewModal && digestResponse && (
        <div className="fixed inset-0 bg-[#1C1C1E] backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#F2F2F7] border border-[#F2F2F7] rounded-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden animate-fade-in">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#F2F2F7] bg-[#FFFFFF] flex justify-between items-center">
              <div>
                <h3 className=" font-medium tracking-wide text-[#1C1C1E] flex items-center gap-2">
                  <Mail size={16} className="text-[#0088FF]" />
                  <span>Morning Study Email Preview</span>
                </h3>
                <p className="text-[#1C1C1E] text-xs  mt-0.5">
                  Showing draft compiled for: <strong className="text-[#0088FF]">{digestResponse.formattedDateLabel}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 hover:bg-[#F2F2F7] rounded-lg text-[#1C1C1E] hover:text-[#1C1C1E] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Simulation Metadata Alert */}
            <div className="px-5 py-2.5 bg-[#F2F2F7] border-b border-[#F2F2F7] text-[11px] text-[#1C1C1E] flex items-center gap-2">
              <AlertCircle size={12} className="text-[#FF8D28] shrink-0" />
              <span>
                {digestResponse.isMotivational 
                  ? "Note: No registered USMLE question logs were found for this period. Showing an actionable study habit motivational reminder instead!" 
                  : "Active analysis loaded: Delivering your diagnostic statistics review."}
              </span>
            </div>

            {/* Email HTML Contents Container frame */}
            <div className="flex-1 overflow-y-auto bg-[#F2F2F7] p-6 flex justify-center">
              <div 
                className="w-full max-w-[550px] bg-[#FFFFFF] rounded-2xl overflow-hidden shadow-inner border border-[#F2F2F7]"
                dangerouslySetInnerHTML={{ __html: digestResponse.htmlContent }}
              />
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
