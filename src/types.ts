/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface USMLERow {
  id: number;
  qid: string;
  topic: string;
  system: string;
  attempt1: 'Correct' | 'Incorrect' | 'Omitted' | '';
  attempt2: 'Correct' | 'Incorrect' | 'Omitted' | '';
  studyGuide: string;
  uploadedMaterials?: string[];
  date?: string;
  hasAttachment?: boolean;
}

export interface TrackerFilters {
  searchQuery: string;
  systemFilter: string;
  attempt1Filter: string;
  attempt2Filter: string;
  dateFrom?: string;
  dateTo?: string;
  hasAttachmentFilter?: boolean;
}
