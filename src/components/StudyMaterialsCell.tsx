/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Folder } from 'lucide-react';
import { 
  subscribeToAuth, 
  getGoogleDriveFolderUrl,
  auth
} from '../services/googleDrive';
import { User } from 'firebase/auth';

interface StudyMaterialsCellProps {
  qid: string;
  onUpdateStudyGuide?: (text: string) => void;
  onUpdateAttachmentStatus?: (hasAttachment: boolean) => void;
}

export default function StudyMaterialsCell({ qid }: StudyMaterialsCellProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Subscribe to central Google Drive Authentication states
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user, token) => {
      setCurrentUser(user);
      setAccessToken(token);
    });
    return unsubscribe;
  }, []);

  const handleFolderClick = async () => {
    if (currentUser && accessToken) {
      const url = await getGoogleDriveFolderUrl(qid, accessToken);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      alert("Please connect your Google Drive first in the Settings tab.");
    }
  };

  return (
    <div className="flex items-center justify-center p-2" id={`study-folder-cell-${qid}`}>
      <button 
        onClick={handleFolderClick}
        className={`text-[12px] font-semibold text-[#1C1C1E] tracking-wider flex items-center gap-1.5 ${currentUser && accessToken ? 'cursor-pointer hover:text-[#0088FF] hover:underline' : 'opacity-60 cursor-not-allowed'}`}
        title={currentUser && accessToken ? "Open Google Drive folder" : "Sign in to Drive to open"}
      >
        <Folder size={14} className={currentUser && accessToken ? "text-[#0088FF] shrink-0" : "text-[#1C1C1E] shrink-0"} />
        {qid}
      </button>
    </div>
  );
}

