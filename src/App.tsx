/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { Info, HelpCircle, Loader2, AlertTriangle } from 'lucide-react';
import { USMLERow, TrackerFilters } from './types';
import { DEFAULT_FIXED_QUESTIONS } from './constants';
import { generateCSVContent } from './utils';
import { subscribeToAuth, saveTrackerDataToDrive, loadTrackerDataFromDrive, googleSignIn, googleSignOut, getAllDriveAttachedQids } from './services/googleDrive';
import { saveProgressToFirestore, loadProgressFromFirestore, listenToProgressFromFirestore } from './services/firebaseDb';

import StatsDashboard from './components/StatsDashboard';
import QuestionTable from './components/QuestionTable';
type AppTab = 'overview' | 'data' | 'settings' | 'revision';

import GamificationTab from './components/GamificationTab';

import RevisionTab from './components/RevisionTab';
import Settings from './components/Settings';
import { AvatarBadge } from './components/AvatarBadge';

const STORAGE_KEY = 'usmle_step2_ck_tracker_questions_fixed_v2';

/**
 * Merge incoming rows into base rows using proper undefined-aware conflict resolution.
 * Fields with value !== undefined in incoming overwrite base (including empty string clears).
 * Date format is normalized from MM/DD/YYYY to YYYY-MM-DD.
 */
function mergeRows(baseRows: any[], incomingRows: any[]): any[] {
  if (!incomingRows || incomingRows.length === 0) return baseRows;

  const combinedMap = new Map<string, any>();
  baseRows.forEach(r => combinedMap.set(String(r.qid), r));

  incomingRows.forEach((dr: any) => {
    const existing = combinedMap.get(String(dr.qid));
    if (existing) {
      combinedMap.set(String(dr.qid), {
        ...existing,
        ...dr,
        // Use !== undefined so that intentional clears (empty string) propagate correctly
        attempt1: dr.attempt1 !== undefined ? dr.attempt1 : existing.attempt1,
        attempt2: dr.attempt2 !== undefined ? dr.attempt2 : existing.attempt2,
        studyGuide: dr.studyGuide !== undefined ? dr.studyGuide : existing.studyGuide,
        date: dr.date !== undefined ? dr.date : existing.date,
      });
    } else {
      combinedMap.set(String(dr.qid), dr);
    }
  });

  return Array.from(combinedMap.values()).map((p: any) => {
    if (p && p.date && p.date.includes('/')) {
      const parts = p.date.split('/');
      if (parts.length === 3) {
        const mm = parts[0].padStart(2, '0');
        const dd = parts[1].padStart(2, '0');
        const yyyy = parts[2];
        return { ...p, date: `${yyyy}-${mm}-${dd}` };
      }
    }
    return p;
  });
}

export default function App() {
  // Drive Auth state
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfilePic, setUserProfilePic] = useState<string | null>(null);
  const [currentUserInfo, setCurrentUserInfo] = useState<{ name: string; email: string } | null>(null);

  // Drive Sync state
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const pendingCloudSkipsRef = useRef(0);
  const isCloudDataLoadedRef = useRef(false);
  const cloudSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAuthenticatedRef = useRef(false);

  // Session state (allow login at one device at a time only)
  const realtimeUnsubscribeRef = useRef<(() => void) | null>(null);

  // Loading & Merging local saved progress with static, unalterable database
  const [rows, setRows] = useState<USMLERow[]>(() => {
    const defaults = DEFAULT_FIXED_QUESTIONS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        let parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Deduplicate based on QID to prevent any duplicates in the database
          const uniqueParsedMap = new Map();
          parsed.forEach((p: any) => {
             if (p && p.qid) {
               // Only prioritize saving valid unique objects.
               // It simply overwrites if a duplicate qid is encountered.
               uniqueParsedMap.set(String(p.qid), p);
             }
          });
          parsed = Array.from(uniqueParsedMap.values());

          // Normalize dates to YYYY-MM-DD
          parsed = parsed.map((p: any) => {
            if (p && p.date && p.date.includes('/')) {
              const parts = p.date.split('/');
              if (parts.length === 3) {
                const mm = parts[0].padStart(2, '0');
                const dd = parts[1].padStart(2, '0');
                const yyyy = parts[2];
                return { ...p, date: `${yyyy}-${mm}-${dd}` };
              }
            }
            return p;
          });

          // Merge student progress logs (attempt1, attempt2, studyGuide) with fixed items
          const merged = defaults.map(def => {
            const match = parsed.find((p: any) => String(p.qid) === String(def.qid));
            if (match) {
              return {
                ...def,
                attempt1: match.attempt1 !== undefined ? match.attempt1 : def.attempt1,
                attempt2: match.attempt2 !== undefined ? match.attempt2 : def.attempt2,
                studyGuide: match.studyGuide !== undefined ? match.studyGuide : def.studyGuide,
                date: match.date !== undefined ? match.date : (def.date !== undefined ? def.date : '')
              };
            }
            return {
              ...def,
              date: def.date !== undefined ? def.date : ''
            };
          });
          
          // Append any dynamically added questions that are not in defaults
          const dynamicallyAdded = parsed.filter((p: any) => 
            !defaults.some(def => String(def.qid) === String(p.qid))
          );
          
          return [...merged, ...dynamicallyAdded];
        }
      }
    } catch (e) {
      console.error('Error loading tracker progress:', e);
    }
    return defaults;
  });
  const rowsRef = useRef(rows);

  // State 2: Active Search & Filter configurations
  const [filters, setFilters] = useState<TrackerFilters>({
    searchQuery: '',
    systemFilter: '',
    attempt1Filter: '',
    attempt2Filter: '',
    dateFrom: '',
    dateTo: ''
  });

  // State 3: Toast alert notifications
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' | null }>({
    text: '',
    type: null
  });

  // Diagnostic states
  const [deviceId] = useState(() => {
    let id = localStorage.getItem('ck_device_id');
    if (!id) {
      id = "DEV_" + Math.random().toString(36).substring(2, 9).toUpperCase();
      localStorage.setItem('ck_device_id', id);
    }
    return id;
  });

  const appendSyncLog = useCallback((method: string) => {
    try {
      const logs = JSON.parse(localStorage.getItem('ck_sync_logs') || '[]');
      logs.unshift({ timestamp: new Date().toISOString(), method, deviceId });
      if (logs.length > 5) logs.length = 5;
      localStorage.setItem('ck_sync_logs', JSON.stringify(logs));
      window.dispatchEvent(new Event('ck_sync_logs_updated'));
    } catch (e) {}
  }, [deviceId]);

  // Load tracker from GDrive when auth state changes
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeToAuth((user, token) => {
      // Clear any prior active session listener
      if (realtimeUnsubscribeRef.current) {
        realtimeUnsubscribeRef.current();
        realtimeUnsubscribeRef.current = null;
      }

      // Always sync attachments (either local or drive) when auth state finalizes
      setTimeout(async () => {
        if (!active) return;

        try {
          let attachedQids: string[] = [];
          if (user && token) {
             attachedQids = await getAllDriveAttachedQids(token);
          } else {
             const res = await fetch('/api/materials/attached-qids');
             if (res.ok) {
               const data = await res.json();
               if (data.success) {
                 attachedQids = data.qids || [];
               }
             }
          }
          
          if (attachedQids.length > 0 && active) {
             setRows(prev => {
                let updated = [...prev];
                let changed = false;
                const todayStr = new Date().toLocaleDateString('en-CA');

                attachedQids.forEach(qidStr => {
                  const existingIdx = updated.findIndex(r => String(r.qid) === String(qidStr));
                  if (existingIdx !== -1) {
                    if (!updated[existingIdx].hasAttachment) {
                      updated[existingIdx] = { ...updated[existingIdx], hasAttachment: true };
                      changed = true;
                    }
                  } else {
                    const newId = updated.length > 0 ? Math.max(...updated.map(r => r.id)) + 1 : 1;
                    const parsedId = parseInt(qidStr, 10);
                    updated.push({
                      id: newId,
                      qid: isNaN(parsedId) ? qidStr : (parsedId as any),
                      topic: 'Imported Document',
                      system: 'Miscellaneous',
                      attempt1: '',
                      attempt2: '',
                      studyGuide: '',
                      date: todayStr,
                      hasAttachment: true
                    });
                    changed = true;
                  }
                });
                return changed ? updated : prev;
             });
          }
        } catch (err) {
           console.error('Failed to sync attached QIDs list:', err);
        }
      }, 500);

      if (user && token) {
        isAuthenticatedRef.current = true;
        setIsDriveSyncing(true);
        setUserProfilePic(user.photoURL || null);
        setCurrentUserInfo({ name: user.displayName || '', email: user.email || '' });
        
        // Fetch Google Drive & Firestore data transparently in the background
        (async () => {
          if (!active) return;
          try {
            // FIX #1: Start realtime listener IMMEDIATELY with buffering
            // This closes the data-loss window where another device could write
            // between "load starts" and "listener attaches".
            const realtimeBuffer: any[] = [];
            let isBuffering = true;

            if (active) {
              realtimeUnsubscribeRef.current = listenToProgressFromFirestore(user.uid, (cloudData) => {
                if (!cloudData) return;

                if (isBuffering) {
                  // Buffer updates that arrive during initial load/merge
                  realtimeBuffer.push(cloudData);
                  return;
                }

                // Live mode: apply realtime update from another device
                const cloudRows = cloudData.rows || [];
                if (cloudRows.length > 0) {
                  appendSyncLog('Cloud Realtime Update');
                  // FIX #2: Increment counter (not boolean) to correctly gate multi-source updates
                  pendingCloudSkipsRef.current++;
                  // FIX #3: mergeRows uses !== undefined, so intentional clears propagate
                  setRows(prevRows => mergeRows(prevRows, cloudRows));
                }

                if (cloudData.purchasedRewards) {
                  setPurchasedRewards(prev => {
                    const merged = { ...prev };
                    let changed = false;
                    for (const k in cloudData.purchasedRewards) {
                      if (cloudData.purchasedRewards[k] !== prev[k]) {
                        merged[k] = cloudData.purchasedRewards[k];
                        changed = true;
                      }
                    }
                    return changed ? merged : prev;
                  });
                }
              });
            }

            // Load from both sources in parallel
            const [driveData, firestoreData] = await Promise.all([
              loadTrackerDataFromDrive(token),
              loadProgressFromFirestore(user.uid)
            ]);
            
            if (!active) return;
            
            let driveRows: any[] = [];
            let driveRewards: any = null;
            let firestoreRows: any[] = [];
            let firestoreRewards: any = null;

            if (driveData) {
              if (Array.isArray(driveData)) {
                driveRows = driveData;
              } else if (driveData.rows && Array.isArray(driveData.rows)) {
                driveRows = driveData.rows;
                driveRewards = driveData.purchasedRewards || null;
              }
            }

            if (firestoreData) {
              if (Array.isArray(firestoreData)) {
                firestoreRows = firestoreData;
              } else if (firestoreData.rows && Array.isArray(firestoreData.rows)) {
                firestoreRows = firestoreData.rows;
                firestoreRewards = firestoreData.purchasedRewards || null;
              }
            }
            
            if (!active) return;

            if ((driveRows && driveRows.length > 0) || (firestoreRows && firestoreRows.length > 0)) {
              // FIX #2: Increment skip counter instead of setting a boolean
              pendingCloudSkipsRef.current++;
              
              // Merge rewards
              let mergedRewardsToSync: Record<string, number> = {};
              try {
                const storedRewards = localStorage.getItem('ck_purchased_rewards');
                if (storedRewards) mergedRewardsToSync = JSON.parse(storedRewards);
              } catch {}
              
              if (driveRewards || firestoreRewards) {
                  const mergedRewards = { ...mergedRewardsToSync };
                  const allKeys = new Set([
                      ...Object.keys(mergedRewards),
                      ...Object.keys(firestoreRewards || {}),
                      ...Object.keys(driveRewards || {})
                  ]);
                  allKeys.forEach(k => {
                      mergedRewards[k] = Math.max(
                          mergedRewards[k] || 0,
                          (firestoreRewards || {})[k] || 0,
                          (driveRewards || {})[k] || 0
                      );
                  });
                  localStorage.setItem('ck_purchased_rewards', JSON.stringify(mergedRewards));
                  mergedRewardsToSync = mergedRewards;
                  setPurchasedRewards(mergedRewardsToSync);
              }

              // FIX #3: Use mergeRows helper with proper !== undefined checks
              // FIX #8: Capture merged result from setRows callback (synchronous), 
              // then do backfill OUTSIDE the state updater
              let finalMerged: any[] = [];
              setRows(prevRows => {
                // Merge local → Drive → Firestore
                let merged = mergeRows(prevRows, driveRows);
                merged = mergeRows(merged, firestoreRows);

                // FIX #1: Apply any buffered realtime updates that arrived during load
                for (const buffered of realtimeBuffer) {
                  const bufferedRows = buffered.rows || [];
                  if (bufferedRows.length > 0) {
                    merged = mergeRows(merged, bufferedRows);
                  }
                }

                finalMerged = merged;
                return merged;
              });

              // Switch from buffer mode to live mode
              isBuffering = false;
              realtimeBuffer.length = 0;

              // FIX #8: Backfill OUTSIDE setRows callback (pure state updaters)
              const payload = { rows: finalMerged, purchasedRewards: mergedRewardsToSync || {} };
              appendSyncLog('Cloud Read & Merge');
              saveProgressToFirestore(user.uid, payload).catch(err => console.warn('Firestore backfill postponed:', err));
              saveTrackerDataToDrive(payload, token).catch(err => console.warn('Drive sync postponed:', err));

              triggerFeedback('Synced study progress across all devices.', 'success');
            } else {
              // No cloud data — but still apply any buffered realtime updates
              // (another device may have written while we were loading)
              if (realtimeBuffer.length > 0) {
                pendingCloudSkipsRef.current++;
                setRows(prevRows => {
                  let merged = prevRows;
                  for (const buffered of realtimeBuffer) {
                    const bufferedRows = buffered.rows || [];
                    if (bufferedRows.length > 0) {
                      merged = mergeRows(merged, bufferedRows);
                    }
                  }
                  return merged;
                });
              }
              isBuffering = false;
              realtimeBuffer.length = 0;
            }
          } catch (e) {
            console.error('Failed to sync in background:', e);
          } finally {
            isCloudDataLoadedRef.current = true;
            if (active) {
              setIsDriveSyncing(false);
              setIsAuthenticated(true);
              setIsAuthLoading(false);
            }
          }
        })();
      } else {
        isAuthenticatedRef.current = false;
        if (active) {
          setIsAuthenticated(false);
          setIsAuthLoading(false);
          setUserProfilePic(null);
          setCurrentUserInfo(null);
        }
      }
    });
    return () => {
      active = false;
      unsubscribe();
      if (realtimeUnsubscribeRef.current) {
        realtimeUnsubscribeRef.current();
        realtimeUnsubscribeRef.current = null;
      }
      // Clean up debounce timer on unmount
      if (cloudSyncTimeoutRef.current) {
        clearTimeout(cloudSyncTimeoutRef.current);
      }
    };
  }, []);

  const [purchasedRewards, setPurchasedRewards] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('ck_purchased_rewards');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {};
  });
  const purchasedRewardsRef = useRef(purchasedRewards);

  const lastSyncRewardsRef = useRef<string>(JSON.stringify(purchasedRewards));

  // Save progress changes whenever user edits attempts or teaching pearls
  useEffect(() => {
    // Keep refs current for debounced cloud writes (avoids stale closures)
    rowsRef.current = rows;
    purchasedRewardsRef.current = purchasedRewards;

    try {
      // Always save to localStorage immediately for local responsiveness
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
      
      const currentRewardsStr = JSON.stringify(purchasedRewards);
      if (currentRewardsStr !== lastSyncRewardsRef.current) {
         localStorage.setItem('ck_purchased_rewards', currentRewardsStr);
         lastSyncRewardsRef.current = currentRewardsStr;
      }
      
      // Auto-sync progress to backend for background task engine
      fetch('/api/sync-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rows })
      }).catch(err => console.error('Silent sync failed', err));

      // FIX #2: Use counter instead of boolean — correctly gates multiple cloud reads
      if (pendingCloudSkipsRef.current > 0) {
        pendingCloudSkipsRef.current--;
      } else if (isAuthenticatedRef.current && isCloudDataLoadedRef.current) {
        // FIX #7: Debounce cloud writes (1.5s) to prevent hammering APIs during typing
        if (cloudSyncTimeoutRef.current) {
          clearTimeout(cloudSyncTimeoutRef.current);
        }

        cloudSyncTimeoutRef.current = setTimeout(() => {
          // Read from refs for latest data (avoids stale closure from debounce delay)
          const payload = { rows: rowsRef.current, purchasedRewards: purchasedRewardsRef.current };
          appendSyncLog('Cloud Write Push');
          saveTrackerDataToDrive(payload).catch(err => console.warn('Drive sync postponed:', err));
          
          import('firebase/auth').then(({ getAuth }) => {
            const user = getAuth().currentUser;
            if (user) {
              saveProgressToFirestore(user.uid, payload).catch(err => console.warn('Firestore sync postponed:', err));
            }
          });
        }, 1500);
      }

    } catch (e) {
      console.error('Failed storing local progress logs:', e);
    }
    // FIX #4: Use isAuthenticatedRef instead of isAuthenticated state to avoid
    // the dependency array problem while still correctly tracking auth status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, purchasedRewards, appendSyncLog]);

  // Flash UI helper notifications
  const triggerFeedback = (text: string, type: 'success' | 'info' | 'error') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => {
      setFeedbackMessage({ text: '', type: null });
    }, 4500);
  };

  // Update a single progression property inside unalterable row
  const handleUpdateRow = useCallback((id: number, field: keyof USMLERow, value: any) => {
    setRows(prev => 
      prev.map(row => {
        if (row.id === id) {
          const updatedRow = { ...row, [field]: value };
          // Automatically stamp the date if setting/changing either attempt1 or attempt2
          if (field === 'attempt1' || field === 'attempt2') {
            if (value && value !== '') {
              updatedRow.date = new Date().toLocaleDateString('en-CA');
            }
          } else if (field === 'studyGuide' && value && value.trim() !== '') {
            // Also set if clinical takeaway is written but date is missing
            if (!row.date) {
              updatedRow.date = new Date().toLocaleDateString('en-CA');
            }
          }
          return updatedRow;
        }
        return row;
      })
    );
  }, []);

  const handleForceSync = useCallback(async () => {
    if (isAuthenticated && isCloudDataLoadedRef.current) {
        setIsDriveSyncing(true);
        triggerFeedback('Initiating manual cloud push...', 'info');
        const payload = { rows, purchasedRewards };
        
        appendSyncLog('Manual Cloud Push Pending');
        
        try {
          const tasks: Promise<any>[] = [];
          
          // Drive sync
          tasks.push(
            saveTrackerDataToDrive(payload).catch(err => {
              console.warn('Drive manual sync failed', err);
              return false;
            })
          );
          
          // Firestore sync with timeout
          const { getAuth } = await import('firebase/auth');
          const user = getAuth().currentUser;
          if (user) {
            const firestorePromise = saveProgressToFirestore(user.uid, payload).catch(err => {
              console.warn('Firestore manual sync failed', err);
              return false;
            });
            // 10 second timeout for firestore to prevent hanging
            const timeoutPromise = new Promise((resolve) => setTimeout(() => {
              console.warn('Firestore sync timed out');
              resolve(false);
            }, 10000));
            tasks.push(Promise.race([firestorePromise, timeoutPromise]));
          }
          
          await Promise.all(tasks);
          
          // Prevent the debounced save effect from writing back what we just pushed
          pendingCloudSkipsRef.current++;
          triggerFeedback('Manual Cloud Push completed safely.', 'success');
          appendSyncLog('Manual Cloud Push Success');
        } catch (e) {
          triggerFeedback('Unexpected error during cloud push.', 'error');
          console.error(e);
        } finally {
          setIsDriveSyncing(false);
        }
    } else {
        triggerFeedback('Cannot force sync: Not fully connected to cloud yet.', 'error');
    }
  }, [isAuthenticated, rows, purchasedRewards, appendSyncLog]);

  // Export progress details into standard CSV sheets
  const handleExportToCSV = useCallback(() => {
    try {
      const csvContent = generateCSVContent(rows);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'UWorld_Step2_CK_Tracker.csv');
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      triggerFeedback('USMLE spreadsheet download initialized successfully.', 'success');
    } catch (e) {
      console.error(e);
      triggerFeedback('Encountered an export exception generating sheets.', 'error');
    }
  }, [rows]);

  // Handle system filters clicked in the Stats Dashboard focus box list
  const handleStatsSystemSelect = useCallback((sysName: string) => {
    setFilters(prev => ({
      ...prev,
      systemFilter: sysName
    }));
  }, []);

  // Reset active configurations
  const handleImportBatch = useCallback((imported: any[], targetAttempt: 'attempt1' | 'attempt2') => {
    setRows(prev => {
      let matchedCount = 0;
      let addedCount = 0;
      const todayStr = new Date().toLocaleDateString('en-CA');
      const updated = [...prev];

      imported.forEach(match => {
        const existingIdx = updated.findIndex((r: any) => String(r.qid) === String(match.qid));
        const score = match.attempt || match.status || 'Omitted';
        
        if (existingIdx !== -1) {
          matchedCount++;
          const row = updated[existingIdx];
          updated[existingIdx] = {
            ...row,
            [targetAttempt]: score,
            studyGuide: row.studyGuide?.trim() ? row.studyGuide : (match.studyGuide || row.studyGuide),
            date: todayStr
          };
        } else {
          addedCount++;
          const newId = updated.length > 0 ? Math.max(...updated.map(r => r.id)) + 1 : 1;
          updated.push({
            id: newId,
            qid: match.qid,
            topic: match.topic || 'Imported from scan',
            system: match.system || 'Miscellaneous',
            attempt1: targetAttempt === 'attempt1' ? score : '',
            attempt2: targetAttempt === 'attempt2' ? score : '',
            studyGuide: match.studyGuide || '',
            date: todayStr
          });
        }
      });

      if (matchedCount > 0 || addedCount > 0) {
        triggerFeedback(`Successfully matched ${matchedCount} existing and added ${addedCount} new questions into ${targetAttempt === 'attempt1' ? '1st Attempt' : '2nd Attempt'}!`, 'success');
      } else {
        triggerFeedback('Scanned visual records, but no corresponding question IDs were found or added.', 'info');
      }
      return updated;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      systemFilter: '',
      attempt1Filter: '',
      attempt2Filter: '',
      dateFrom: '',
      dateTo: '',
      hasAttachmentFilter: false
    });
  }, []);

  const [activeTab, setActiveTab] = useState<AppTab>('overview');

  const handleLoginClick = async () => {
    try {
      setIsAuthLoading(true);
      await googleSignIn();
    } catch (err: any) {
      console.error('Login failed:', err);
      // We can also trigger feedback. Note: we need to handle this.
      triggerFeedback('Login blocked or failed. If you are on mobile, you MUST open the app in a new tab (arrow top-right).', 'error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const totalAttempted = rows.filter(r => r.attempt1 === 'Correct' || r.attempt1 === 'Incorrect' || r.attempt1 === 'Omitted').length;

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex flex-col justify-center items-center gap-6">
        <Loader2 size={48} className="animate-spin text-[#0088FF]" />
        <div className="text-center">
          <h2 className="text-[#1C1C1E] font-bold text-[18px] mb-1">Syncing Workspace</h2>
          <p className="text-[#8E8E93] text-[14px]">Fetching your latest data from Cloud...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E] flex flex-col  justify-center items-center p-4">
        <div className="bg-[#FFFFFF] p-8 md:p-10 rounded-3xl shadow-sm text-center max-w-sm border border-[#F2F2F7]">
          <h1 className="text-2xl font-medium tracking-wide tracking-tight mb-2">Login Required</h1>
          <p className="text-sm text-[#1C1C1E] mb-6 leading-relaxed">Please connect your Google Account to unlock your progression dashboard and cloud sync.</p>
          
          <div className="bg-[#FFF8E6] p-4 rounded-xl border border-[#FFD573] mb-6 text-left shadow-sm">
            <h4 className="text-[12px] font-medium tracking-wide text-[#b58000] mb-1 flex items-center gap-1.5">
              <AlertTriangle size={14} /> Attention Mobile/AI Studio Users
            </h4>
            <p className="text-[11px] text-[#A67500] leading-snug">
              If you are viewing this on a phone inside AI Studio, your browser will block the login popup.<br/><br/>
              <strong>You MUST tap the "Open in new tab" arrow ↗️ icon at the top right of this preview window before logging in!</strong>
            </p>
          </div>

          <button 
            onClick={handleLoginClick} 
            className="w-full py-4 bg-[#0088FF] text-[#FFFFFF] rounded-full font-medium tracking-wide shadow-md transition-shadow hover:shadow-lg flex items-center justify-center gap-2"
          >
            Authenticate with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E] flex flex-col  selection:bg-[#0088FF] antialiased" id="ck-tracker-root-layout">
      
      {/* Dynamic top pop toast notifications */}
      {feedbackMessage.type && (
        <motion.div
          initial={{ opacity: 0, y: -45 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -45 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-[18px] py-3 rounded-xl shadow-lg border text-sm font-medium ${
            feedbackMessage.type === 'success' ? 'bg-[#F2F2F7] border-[#F2F2F7] text-[#34C759]' :
            feedbackMessage.type === 'error' ? 'bg-[#F2F2F7] border-[#F2F2F7] text-[#FF383C]' :
            'bg-[#F2F2F7] border-[#F2F2F7] text-[#1C1C1E] shadow-sm'
          }`}
          id="toast-notification-panel"
        >
          <Info size={16} className={feedbackMessage.type === 'success' ? 'text-[#34C759]' : feedbackMessage.type === 'error' ? 'text-[#FF383C]' : 'text-[#0088FF]'} />
          <span>{feedbackMessage.text}</span>
        </motion.div>
      )}

      {/* Main Container */}
      <main className="flex-1 py-6 px-4 md:px-8 max-w-7xl w-full mx-auto flex flex-col justify-start" id="main-application-frame">
        
        {/* Floating Top Header Area */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 z-10 sticky top-4 w-full">
          <div className="flex-1 hidden md:flex items-center"></div>
          
          {/* Floating Top Navigation (Pill Style / Attached Look) */}
          <div className="flex bg-[#F2F2F7] border border-[#F2F2F7] rounded-full p-1 overflow-x-auto justify-center max-w-fit shadow-sm items-center shrink-0" id="main-tab-bar">
            
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-2 rounded-full text-[16px] font-bold transition-all whitespace-nowrap ${
                activeTab === 'overview' ? 'bg-[#1C1C1E] text-[#FFFFFF] shadow-md' : 'text-[#1C1C1E] hover:text-[#1C1C1E]'
              }`}
            >
              Home
            </button>
            
            <button
              onClick={() => setActiveTab('data')}
              className={`px-6 py-2 rounded-full text-[16px] font-bold transition-all whitespace-nowrap ${
                activeTab === 'data' ? 'bg-[#1C1C1E] text-[#FFFFFF] shadow-md' : 'text-[#1C1C1E] hover:text-[#1C1C1E]'
              }`}
            >
              Database
            </button>
            
            <button
              onClick={() => setActiveTab('revision')}
              className={`px-6 py-2 rounded-full text-[16px] font-bold transition-all whitespace-nowrap ${
                activeTab === 'revision' ? 'bg-[#1C1C1E] text-[#FFFFFF] shadow-md' : 'text-[#1C1C1E] hover:text-[#1C1C1E]'
              }`}
            >
              Revision
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-2 rounded-full text-[16px] font-bold transition-all whitespace-nowrap ${
                activeTab === 'settings' ? 'bg-[#1C1C1E] text-[#FFFFFF] shadow-md' : 'text-[#1C1C1E] hover:text-[#1C1C1E]'
              }`}
            >
              Settings
            </button>

            {isDriveSyncing && (
              <div className="flex items-center gap-1.5 px-4 py-2 bg-[#0088FF]/10 text-[#0088FF] rounded-full text-xs font-semibold mr-1 animate-pulse shrink-0">
                <Loader2 className="animate-spin" size={13} />
                <span>Syncing</span>
              </div>
            )}
          </div>

          <div className="flex-1 flex justify-end items-center shrink-0">
             {currentUserInfo && (
                <div className="flex bg-[#F2F2F7] border border-[#F2F2F7] rounded-full p-1 shadow-sm items-center gap-1">
                  <div className="px-3 py-1 text-sm font-medium text-[#1C1C1E] max-w-[150px] truncate hidden xl:block">
                    {currentUserInfo.name || currentUserInfo.email}
                  </div>
                  <button
                    onClick={googleSignOut}
                    className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold bg-[#1C1C1E] text-white hover:bg-[#FF383C] transition-colors shadow-sm whitespace-nowrap"
                  >
                    Log Out
                  </button>
                </div>
             )}
          </div>
        </div>

        <div className={`rounded-3xl overflow-hidden flex flex-col flex-1 ${activeTab !== 'overview' ? 'bg-[#FFFFFF] shadow-sm border border-[#F2F2F7]' : 'gap-4'}`} id="spreadsheet-central-card">
          
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6 w-full items-stretch">
              {/* Gamification Top / Weekly UI */}
              <div className="w-full flex flex-col">
                <GamificationTab rows={rows} purchasedRewards={purchasedRewards} setPurchasedRewards={setPurchasedRewards} />
              </div>

              {/* Stats Dashboard (4 Pills) */}
              <div className="w-full flex flex-col">
                <StatsDashboard
                  rows={rows}
                  onSelectSystemFilter={(sys) => {
                    handleStatsSystemSelect(sys);
                    setActiveTab('data');
                  }}
                  activeSystemFilter={filters.systemFilter}
                />
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <QuestionTable
              rows={rows}
              filters={filters}
              onChangeFilters={setFilters}
              onUpdateRow={handleUpdateRow}
              onClearFilters={handleClearFilters}
              onImportBatch={handleImportBatch}
            />
          )}

          {activeTab === 'revision' && (
            <RevisionTab rows={rows} />
          )}

          {activeTab === 'settings' && (
            <Settings 
              rows={rows} 
              onExport={handleExportToCSV}
              onForceSync={handleForceSync}
            />
          )}
          
        </div>

        {/* Clinical Disclaimer footer */}
        <footer className="mt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-[#1C1C1E] gap-4 px-2" id="tracker-educational-footer">
          <div className="flex items-center gap-2" id="footer-notes">
            <HelpCircle size={15} className="text-[#1C1C1E]" />
            <p className="text-[#1C1C1E]">
              <strong>Tip:</strong> Upload high-yield PDF summaries directly into the structured QID folders to maintain synchronized study folders.
            </p>
          </div>
          <div className="sm:text-right  text-[10px] text-[#1C1C1E]" id="footer-credits">
            <span>UWorld Review Space • Fixed QID Exam Database Structure</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
