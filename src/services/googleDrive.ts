/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize firebase app if needed
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
// Force select account to ensure prompt
provider.setCustomParameters({
  prompt: 'select_account'
});

let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('drive_access_token') : null;
const TOKEN_MAX_AGE_MS = 50 * 60 * 1000; // 50 minutes (Google OAuth tokens expire at 60 min)

function isTokenFresh(): boolean {
  const ts = localStorage.getItem('drive_token_timestamp');
  if (!ts) return !!cachedAccessToken; // If no timestamp stored, assume fresh if token exists
  return (Date.now() - parseInt(ts, 10)) < TOKEN_MAX_AGE_MS;
}

export function invalidateFolderCaches(): void {
  localStorage.removeItem('usmle_gdrive_parent_folder_id');
  parentFolderPromise = null;
  // Clear all QID folder caches
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('usmle_gdrive_qid_folder_id_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  Object.keys(qidFolderPromises).forEach(k => delete qidFolderPromises[k]);
}

// Subscriptions
let listeners: Array<(user: User | null, token: string | null) => void> = [];

export function subscribeToAuth(callback: (user: User | null, token: string | null) => void) {
  listeners.push(callback);
  // Trigger initial callback
  callback(auth.currentUser, cachedAccessToken);
  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
}

function notifyListeners(user: User | null, token: string | null) {
  listeners.forEach(cb => cb(user, token));
}

// Handle redirect results on page load
getRedirectResult(auth).then((result) => {
  if (result) {
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      localStorage.setItem('drive_intent_connected', 'true');
      localStorage.setItem('drive_access_token', cachedAccessToken);
      localStorage.setItem('drive_token_timestamp', String(Date.now()));
      notifyListeners(result.user, cachedAccessToken);
    }
  }
}).catch(error => {
  console.error("Redirect sign-in error:", error);
});

// Check local storage for initial auth token cached safely for seamless UX
// On first mount or on state change
onAuthStateChanged(auth, async (user: User | null) => {
  if (user) {
    // Attempt to salvage cached token from memory or if signed-in
    if (!cachedAccessToken && typeof window !== 'undefined') {
      cachedAccessToken = localStorage.getItem('drive_access_token');
    }
    // Proactively clear stale tokens so the UI can prompt re-auth
    if (cachedAccessToken && !isTokenFresh()) {
      console.warn('Cached Google OAuth token is stale (>50 min). Clearing for re-authentication.');
      cachedAccessToken = null;
      localStorage.removeItem('drive_access_token');
      localStorage.removeItem('drive_token_timestamp');
    }
    notifyListeners(user, cachedAccessToken);
  } else {
    cachedAccessToken = null;
    localStorage.removeItem('drive_access_token');
    localStorage.removeItem('drive_token_timestamp');
    notifyListeners(null, null);
  }
});

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  try {
    isSigningIn = true;
    
    // First try popup
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to retrieve OAuth access token from Google identity.');
      }
      cachedAccessToken = credential.accessToken;
      localStorage.setItem('drive_intent_connected', 'true');
      localStorage.setItem('drive_access_token', cachedAccessToken);
      localStorage.setItem('drive_token_timestamp', String(Date.now()));
      notifyListeners(result.user, cachedAccessToken);
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (popupError: any) {
      console.warn("Popup sign in failed or blocked. Trying redirect...", popupError);
      // Fallback to redirect which works in iframes/iOS better (if not blocked by iframe X-Frame-Options)
      await signInWithRedirect(auth, provider);
      return null; // Page will exit here
    }
  } catch (error: any) {
    console.error('Core sign in failure:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const googleSignOut = async () => {
  try {
    await signOut(auth);
  } catch (e) {}
  cachedAccessToken = null;
  localStorage.removeItem('drive_intent_connected');
  localStorage.removeItem('drive_access_token');
  localStorage.removeItem('drive_token_timestamp');
  invalidateFolderCaches();
  notifyListeners(null, null);
};

export const getAccessToken = (): string | null => {
  if (cachedAccessToken && !isTokenFresh()) {
    console.warn('Access token expired. Clearing cached token.');
    cachedAccessToken = null;
    localStorage.removeItem('drive_access_token');
    localStorage.removeItem('drive_token_timestamp');
    return null;
  }
  return cachedAccessToken;
};

// ==========================================
// GOOGLE DRIVE API OPERATIONS
// ==========================================

const PARENT_FOLDER_NAME = 'Study Material';

// In-memory Promise cache to serialize concurrent requests and avoid double-creations
let parentFolderPromise: Promise<string> | null = null;
const qidFolderPromises: Record<string, Promise<string>> = {};

/**
 * Searches for a folder with the specified name and parents constraint.
 */
async function findFolder(name: string, parentId?: string, token?: string): Promise<string | null> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) throw new Error('Unauthenticated Google Drive access request.');

  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${activeToken}` }
  });

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 401) {
       await googleSignOut();
       throw new Error('UNAUTHENTICATED');
    }
    console.error(`Find folder error for '${name}':`, errorText);
    return null;
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

/**
 * Searches for a file with the specified name and parents constraint.
 */
async function findFile(name: string, parentId?: string, token?: string): Promise<string | null> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) throw new Error('Unauthenticated Google Drive access request.');

  let query = `name='${name}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${activeToken}` }
  });

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 401) {
       await googleSignOut();
       throw new Error('UNAUTHENTICATED');
    }
    console.error(`Find file error for '${name}':`, errorText);
    return null;
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

/**
 * Uploads a file directly to the parent Study Material folder on Google Drive.
 */
export async function uploadAudioToParentFolder(file: File, token?: string): Promise<any> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) throw new Error('Unauthenticated Google Drive file upload request.');

  try {
    const parentId = await getOrCreateParentFolder(activeToken);

    // 1. Create file metadata entry in Drive
    const metadata = {
      name: file.name,
      parents: [parentId]
    };

    const metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activeToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!metaRes.ok) {
        const errorText = await metaRes.text();
        if (metaRes.status === 401) {
           await googleSignOut();
           throw new Error('UNAUTHENTICATED');
        }
        throw new Error(`Failed to initialize file metadata: ${errorText}`);
    }

    const metaData = await metaRes.json();
    const fileId = metaData.id;

    // 2. Upload file content payload
    const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${activeToken}`,
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      if (uploadRes.status === 401) {
         await googleSignOut();
         throw new Error('UNAUTHENTICATED');
      }
      throw new Error(`Failed to stream media payload to Google Drive: ${errorText}`);
    }

    return await uploadRes.json();
  } catch (error: any) {
    if (error && error.message === 'UNAUTHENTICATED') {
      console.warn('Google Drive audio upload postponed: User is unauthenticated.');
    } else {
      console.error(`Upload error for Audio:`, error);
    }
    throw error;
  }
}

export async function saveTrackerDataToDrive(data: any, token?: string): Promise<boolean> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) return false; // Fail silently if not authenticated

  try {
    const parentId = await getOrCreateParentFolder(activeToken);
    const fileName = 'tracker_data.json';
    const existingFileId = await findFile(fileName, parentId, activeToken);

    const fileContent = JSON.stringify(data);
    const fileBlob = new Blob([fileContent], { type: 'application/json' });

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    const metadata: any = {
      name: fileName,
      mimeType: 'application/json'
    };

    if (existingFileId) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`;
      method = 'PATCH';
    } else {
      metadata.parents = [parentId];
    }

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileBlob);

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${activeToken}`
      },
      body: form
    });

    if (res.status === 401) {
       await googleSignOut();
       throw new Error('UNAUTHENTICATED');
    }

    if (res.status === 404) {
      // Parent folder was deleted externally — clear caches so next call recreates
      invalidateFolderCaches();
      console.warn('Drive tracker file/folder not found (404). Folder caches invalidated for next attempt.');
    }

    return res.ok;
  } catch (error: any) {
    if (error && error.message === 'UNAUTHENTICATED') {
      console.warn('Failed to sync tracker data to Google Drive: User is unauthenticated.');
    } else {
      console.error('Failed to sync tracker data to Google Drive:', error);
    }
    return false;
  }
}

/**
 * Downloads the persistent user database file
 */
export async function loadTrackerDataFromDrive(token?: string): Promise<any | null> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) return null;

  try {
    const parentId = await getOrCreateParentFolder(activeToken);
    const fileName = 'tracker_data.json';
    const fileId = await findFile(fileName, parentId, activeToken);

    if (!fileId) return null; // File doesn't exist yet

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${activeToken}` }
    });

    if (!res.ok) {
      if (res.status === 401) {
         await googleSignOut();
         throw new Error('UNAUTHENTICATED');
      }
      return null;
    }
    return await res.json();
  } catch (error: any) {
    if (error && error.message === 'UNAUTHENTICATED') {
      console.warn('Failed to load tracker data from Google Drive: User is unauthenticated.');
    } else {
      console.error('Failed to load tracker data from Google Drive:', error);
    }
    return null;
  }
}

/**
 * Creates a folder with the specified name and parent constraint.
 */
async function createFolder(name: string, parentId?: string, token?: string): Promise<string> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) throw new Error('Unauthenticated Google Drive folder creation request.');

  const metadata: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder'
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${activeToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 401) {
       await googleSignOut();
       throw new Error('UNAUTHENTICATED');
    }
    throw new Error(`Failed to create directory '${name}' on Google Drive: ${errorText}`);
  }

  const data = await res.json();
  return data.id;
}

/**
 * Returns parent folder ID if exists, or creates it.
 */
export async function getOrCreateParentFolder(token?: string): Promise<string> {
  const activeToken = token || cachedAccessToken;

  // 1. Check local storage cache first
  const cachedParentId = localStorage.getItem('usmle_gdrive_parent_folder_id');
  if (cachedParentId) {
    return cachedParentId;
  }

  // 2. If a parent folder promise is already running, wait for it
  if (parentFolderPromise) {
    return parentFolderPromise;
  }

  // 3. Otherwise, initiate findings & potential creation
  parentFolderPromise = (async () => {
    try {
      const existingId = await findFolder(PARENT_FOLDER_NAME, undefined, activeToken);
      if (existingId) {
        localStorage.setItem('usmle_gdrive_parent_folder_id', existingId);
        return existingId;
      }

      const newId = await createFolder(PARENT_FOLDER_NAME, undefined, activeToken);
      localStorage.setItem('usmle_gdrive_parent_folder_id', newId);
      return newId;
    } catch (err) {
      // Clear on failure so next attempt can retry
      parentFolderPromise = null;
      throw err;
    }
  })();

  return parentFolderPromise;
}

/**
 * Returns an array of QIDs that have attached files in Google Drive.
 */
export async function getAllDriveAttachedQids(token?: string): Promise<string[]> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) return [];

  try {
    const parentId = await getOrCreateParentFolder(activeToken);
    
    // We fetch ALL files and folders inside the parent directory
    const query = `'${parentId}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&pageSize=1000`;
    
    const res = await fetch(url, { headers: { Authorization: `Bearer ${activeToken}` } });
    if (!res.ok) {
      if (res.status === 401) {
         await googleSignOut();
         throw new Error('UNAUTHENTICATED');
      }
      return [];
    }

    const data = await res.json();
    const files = data.files || [];
    const attachedQids = new Set<string>();

    for (const f of files) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        let folderQid = f.name;
        if (f.name.toUpperCase().startsWith('QID_')) {
          folderQid = f.name.substring(4);
        } else if (f.name.toLowerCase().startsWith('uq_')) {
          folderQid = f.name.substring(3);
        }
        if (/^\d{4,6}$/.test(folderQid)) {
          // Note: In a rigorous implementation we'd check if this folder is empty, 
          // but for performance we just assume if the folder exists, something is attached or was intended to be.
          attachedQids.add(folderQid);
        }
      } else {
        const match = f.name.match(/QID_(\d{4,6})|uq_(\d{4,6})|(\d{4,6})/i);
        if (match) {
          const qid = match[1] || match[2] || match[3];
          attachedQids.add(qid);
        }
      }
    }

    return Array.from(attachedQids);
  } catch (err: any) {
    if (err && err.message === 'UNAUTHENTICATED') {
      console.warn('Failed fetching drive attached QIDs: User is unauthenticated.');
    } else {
      console.error('Failed fetching drive attached QIDs:', err);
    }
    return [];
  }
}

export async function getGoogleDriveFolderUrl(qid: string, token?: string): Promise<string | null> {
  try {
    const activeToken = token || cachedAccessToken;
    if (!activeToken) return null;
    const folderId = await getOrCreateQidFolder(qid, activeToken);
    return `https://drive.google.com/drive/folders/${folderId}`;
  } catch (error) {
    console.error("Failed to get Google Drive folder URL:", error);
    return null;
  }
}

/**
 * Returns QID folder ID if exists, or creates it in parent.
 */
export async function getOrCreateQidFolder(qid: string, token?: string): Promise<string> {
  const activeToken = token || cachedAccessToken;
  const parentId = await getOrCreateParentFolder(activeToken);

  // 1. Check local storage cache for this QID first
  const cacheKey = `usmle_gdrive_qid_folder_id_${qid}`;
  const cachedQidId = localStorage.getItem(cacheKey);
  if (cachedQidId) {
    return cachedQidId;
  }

  // 2. If already creating/finding this specific QID folder, reuse promise
  if (qidFolderPromises[qid]) {
    return qidFolderPromises[qid];
  }

  // 3. Otherwise, find or create under the main parent folder
  qidFolderPromises[qid] = (async () => {
    try {
      const qidFolderName = `QID_${qid}`;
      const existingId = await findFolder(qidFolderName, parentId, activeToken);
      if (existingId) {
        localStorage.setItem(cacheKey, existingId);
        return existingId;
      }

      const newId = await createFolder(qidFolderName, parentId, activeToken);
      localStorage.setItem(cacheKey, newId);
      return newId;
    } catch (err) {
      delete qidFolderPromises[qid];
      throw err;
    }
  })();

  return qidFolderPromises[qid];
}

/**
 * List files inside folder QID or parent folder (if matched by QID in name).
 */
export async function listFilesForQid(qid: string, token?: string): Promise<Array<{ id: string; name: string; mimeType: string; webViewLink?: string; size?: string }>> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) return [];

  try {
    const qidFolderId = await getOrCreateQidFolder(qid, activeToken);
    const parentId = await getOrCreateParentFolder(activeToken);

    const qidQuery = `'${qidFolderId}' in parents and trashed=false`;
    const qidUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qidQuery)}&fields=files(id,name,mimeType,webViewLink,size)`;

    const parentQuery = `'${parentId}' in parents and name contains '${qid}' and mimeType != 'application/vnd.google-apps.folder' and trashed=false`;
    const parentUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(parentQuery)}&fields=files(id,name,mimeType,webViewLink,size)`;

    const [qidRes, parentRes] = await Promise.all([
      fetch(qidUrl, { headers: { Authorization: `Bearer ${activeToken}` } }),
      fetch(parentUrl, { headers: { Authorization: `Bearer ${activeToken}` } })
    ]);

    if (qidRes.status === 401 || parentRes.status === 401) {
       await googleSignOut();
       throw new Error('UNAUTHENTICATED');
    }

    let qidFiles: any[] = [];
    if (qidRes.ok) {
      const qidData = await qidRes.json();
      qidFiles = qidData.files || [];
    } else if (qidRes.status === 404) {
      // Cached folder probably deleted in Drive - wipe local cache to force recreation next time
      localStorage.removeItem('usmle_gdrive_parent_folder_id');
      localStorage.removeItem(`usmle_gdrive_qid_folder_id_${qid}`);
      parentFolderPromise = null;
      delete qidFolderPromises[qid];
    }

    let parentFiles: any[] = [];
    if (parentRes.ok) {
      const parentData = await parentRes.json();
      parentFiles = parentData.files || [];
    }

    // Merge and de-duplicate files by name or ID
    const merged: Array<{ id: string; name: string; mimeType: string; webViewLink?: string; size?: string }> = [...qidFiles];
    parentFiles.forEach(pf => {
      if (!merged.some(mf => mf.id === pf.id || mf.name === pf.name)) {
        merged.push(pf);
      }
    });

    return merged;
  } catch (error: any) {
    if (error && error.message === 'UNAUTHENTICATED') {
      console.warn(`Failed listing files for QID ${qid}: User is unauthenticated.`);
    } else {
      console.error(`Failed listing files for QID ${qid}:`, error);
    }
    return [];
  }
}

/**
 * Uploads a file to QID folder on Google Drive.
 */
export async function uploadFileToQid(qid: string, file: File, token?: string): Promise<any> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) throw new Error('Unauthenticated Google Drive file upload request.');

  let qidFolderId = await getOrCreateQidFolder(qid, activeToken);

  try {
    // 1. Create file metadata entry in Drive
    const metadata = {
      name: file.name,
      parents: [qidFolderId]
    };

    let metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activeToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!metaRes.ok) {
      if (metaRes.status === 401) {
         await googleSignOut();
         throw new Error('UNAUTHENTICATED');
      }
      if (metaRes.status === 404) {
        // Clear caches and try once more on 404
        localStorage.removeItem('usmle_gdrive_parent_folder_id');
        localStorage.removeItem(`usmle_gdrive_qid_folder_id_${qid}`);
        parentFolderPromise = null;
        delete qidFolderPromises[qid];

        qidFolderId = await getOrCreateQidFolder(qid, activeToken);
        metadata.parents = [qidFolderId];

        metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metadata)
        });

        if (!metaRes.ok) {
          if (metaRes.status === 401) {
             await googleSignOut();
             throw new Error('UNAUTHENTICATED');
          }
          const errorText = await metaRes.text();
          throw new Error(`Failed to initialize file metadata: ${errorText}`);
        }
      } else {
        const errorText = await metaRes.text();
        throw new Error(`Failed to initialize file metadata: ${errorText}`);
      }
    }

    const metaData = await metaRes.json();
    const fileId = metaData.id;

    // 2. Upload file content payload
    const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${activeToken}`,
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    });

    if (!uploadRes.ok) {
      if (uploadRes.status === 401) {
         await googleSignOut();
         throw new Error('UNAUTHENTICATED');
      }
      const errorText = await uploadRes.text();
      throw new Error(`Failed to stream media payload to Google Drive: ${errorText}`);
    }

    return await uploadRes.json();
  } catch (error: any) {
    if (error && error.message === 'UNAUTHENTICATED') {
      console.warn(`Upload error for QID ${qid}: User is unauthenticated.`);
    } else {
      console.error(`Upload error for QID ${qid}:`, error);
    }
    throw error;
  }
}

/**
 * Deletes file from Google Drive.
 */
export async function deleteFileFromDrive(fileId: string, token?: string): Promise<boolean> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) throw new Error('Unauthenticated Google Drive request.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${activeToken}` }
  });

  if (res.status === 401) {
     await googleSignOut();
     throw new Error('UNAUTHENTICATED');
  }

  return res.ok;
}
