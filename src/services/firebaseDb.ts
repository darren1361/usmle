import { getFirestore, doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { app } from './googleDrive'; // Need to export app from googleDrive.ts or initialize here

const db = getFirestore(app);

export const registerAndListenSession = async (
  uid: string,
  deviceId: string,
  onSessionTerminated: () => void,
  onError?: (err: Error) => void
): Promise<() => void> => {
  const sessionDocRef = doc(db, 'users', uid, 'progress', 'session_active');
  
  try {
    // Await the write to ensure we claimed the session
    await setDoc(sessionDocRef, {
      deviceId,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err: any) {
    console.warn('Failed to register active session:', err);
    if (onError) onError(err);
    // Don't attach listener if we couldn't register — it would see stale data
    return () => {};
  }

  // Listen in real-time to active sessions
  const unsubscribe = onSnapshot(sessionDocRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data && data.deviceId && data.deviceId !== deviceId) {
        console.log('Session termination triggered. Local:', deviceId, 'Remote:', data.deviceId);
        onSessionTerminated();
      }
    }
  }, (err) => {
    console.warn('Active session listener error:', err);
    if (onError) onError(err);
  });

  return unsubscribe;
};

export const saveProgressToFirestore = async (uid: string, data: any) => {
  try {
    const docRef = doc(db, 'users', uid, 'progress', 'tracker_data');
    
    // If data.rows exists, it means we are passing the new structured object
    // otherwise if it's just an array, it's the old format
    const payload = Array.isArray(data) ? { rows: data } : { ...data };
    
    await setDoc(docRef, {
      ...payload,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('offline') || msg.includes('network') || msg.includes('permission')) {
      console.warn('Firestore sync postponed: offline/restricted connection.');
    } else {
      console.error('Failed to sync to Firestore:', error);
    }
    return false;
  }
};

export const loadProgressFromFirestore = async (uid: string) => {
  try {
    const docRef = doc(db, 'users', uid, 'progress', 'tracker_data');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('offline') || msg.includes('network') || msg.includes('permission')) {
      console.warn('Firestore load skipped: offline/restricted connection.');
    } else {
      console.error('Failed to load from Firestore:', error);
    }
  }
  return null;
};

export const listenToProgressFromFirestore = (uid: string, onUpdate: (data: any) => void) => {
  const docRef = doc(db, 'users', uid, 'progress', 'tracker_data');
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      // Avoid infinite loop if this device originated the write (hasPendingWrites = true)
      // Actually we might want this update anyway if it's merged or if we prefer cloud authority
      const data = snap.data();
      if (!snap.metadata.hasPendingWrites) {
         onUpdate(data);
      }
    }
  }, (error) => {
    console.warn('Firestore realtime sync error:', error);
  });
};
