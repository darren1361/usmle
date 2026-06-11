/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { USMLERow } from './types';
import { SYSTEM_OPTIONS } from './constants';

/**
 * Custom robust CSV parser that handles:
 * - Line endings (\r\n vs \n)
 * - Quotes enclosing text values
 * - Escaped double quotes ("" -> ")
 * - Commas in fields without breaking parsing columns.
 */
export function parseCSV(text: string): Partial<USMLERow>[] {
  const result: Partial<USMLERow>[] = [];
  const lines = text.split(/\r?\n/);
  
  if (lines.length < 2) return [];

  // Parse headers
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  // Find column indexes to be robust to column order
  const qidIdx = headers.findIndex(h => h.toLowerCase().includes('qid') || h.toLowerCase().includes('question'));
  const sysIdx = headers.findIndex(h => h.toLowerCase().includes('system') || h.toLowerCase().includes('category'));
  const att1Idx = headers.findIndex(h => h.toLowerCase().includes('1st') || h.toLowerCase().includes('first') || h.toLowerCase().includes('attempt1'));
  const att2Idx = headers.findIndex(h => h.toLowerCase().includes('2nd') || h.toLowerCase().includes('second') || h.toLowerCase().includes('attempt2'));
  const sgIdx = headers.findIndex(h => h.toLowerCase().includes('guide') || h.toLowerCase().includes('takeaway') || h.toLowerCase().includes('note') || h.toLowerCase().includes('study'));

  // Use mapping or fallback to standard columns [0, 1, 2, 3, 4]
  const qIndex = qidIdx !== -1 ? qidIdx : 0;
  const sIndex = sysIdx !== -1 ? sysIdx : 1;
  const a1Index = att1Idx !== -1 ? att1Idx : 2;
  const a2Index = att2Idx !== -1 ? att2Idx : 3;
  const sgIndex = sgIdx !== -1 ? sgIdx : 4;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length === 0) continue;

    const rawQid = values[qIndex] || '';
    let system = values[sIndex] || '';
    let attempt1 = (values[a1Index] || '') as any;
    let attempt2 = (values[a2Index] || '') as any;
    const studyGuide = values[sgIndex] || '';

    // Standardize attempt values
    const matchAttempt = (val: string): 'Correct' | 'Incorrect' | 'Omitted' | '' => {
      const v = val.trim().toLowerCase();
      if (v.startsWith('cor')) return 'Correct';
      if (v.startsWith('inc') || v.startsWith('wr')) return 'Incorrect';
      if (v.startsWith('omi') || v.startsWith('sk')) return 'Omitted';
      return '';
    };

    const finalAttempt1 = matchAttempt(attempt1);
    const finalAttempt2 = matchAttempt(attempt2);

    // Standardize system values
    const cleanSystem = system.trim();
    let finalSystem = '';
    
    if (cleanSystem) {
      // Find case-insensitive match
      const matched = SYSTEM_OPTIONS.find(
        (opt) => opt.toLowerCase() === cleanSystem.toLowerCase()
      );
      if (matched) {
        finalSystem = matched;
      } else {
        // Fallback: see if any system includes it or vice versa
        const partial = SYSTEM_OPTIONS.find(
          (opt) => opt.toLowerCase().includes(cleanSystem.toLowerCase()) || 
                   cleanSystem.toLowerCase().includes(opt.toLowerCase())
        );
        finalSystem = partial || SYSTEM_OPTIONS[3] || ''; // fallback or general principles
      }
    }

    result.push({
      qid: rawQid.trim().slice(0, 15), // avoid overly large junk inputs
      system: finalSystem,
      attempt1: finalAttempt1,
      attempt2: finalAttempt2,
      studyGuide: studyGuide
    });
  }

  return result;
}

/**
 * Splits a single CSV string line correctly, respecting quotes.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Check if it is an escaped quote inside double quotes -> ""
      if (inQuotes && line[i + 1] === '"') {
        currentValue += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  result.push(currentValue);
  return result;
}

/**
 * Serializes standard USMLERow[] into a download-safe CSV.
 */
export function generateCSVContent(rows: USMLERow[]): string {
  const headers = ['QID', 'System', 'First Attempt', 'Second Attempt', 'Date', 'Study Guide / Key Takeaway'];
  const csvRows = [
    headers.join(','),
    ...rows.map(row => {
      const qid = `"${String(row.qid).replace(/"/g, '""')}"`;
      const system = `"${String(row.system).replace(/"/g, '""')}"`;
      const attempt1 = `"${String(row.attempt1).replace(/"/g, '""')}"`;
      const attempt2 = `"${String(row.attempt2).replace(/"/g, '""')}"`;
      const date = `"${String(row.date || '').replace(/"/g, '""')}"`;
      const studyGuide = `"${String(row.studyGuide).replace(/"/g, '""')}"`;
      return `${qid},${system},${attempt1},${attempt2},${date},${studyGuide}`;
    })
  ];
  return csvRows.join('\n');
}
