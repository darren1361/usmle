/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Search, Filter, HelpCircle, Calendar, Paperclip, ChevronDown, Pin, FileText, Plus, UploadCloud, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { USMLERow, TrackerFilters } from '../types';
import { SYSTEM_OPTIONS, ATTEMPT_OPTIONS } from '../constants';
import StudyMaterialsCell from './StudyMaterialsCell';

interface QuestionTableProps {
  rows: USMLERow[];
  filters: TrackerFilters;
  onChangeFilters: (filters: TrackerFilters) => void;
  onUpdateRow: (id: number, field: keyof USMLERow, value: any) => void;
  onClearFilters: () => void;
  onImportBatch: (imported: any[], targetAttempt: 'attempt1' | 'attempt2') => void;
}

export default function QuestionTable({
  rows,
  filters,
  onChangeFilters,
  onUpdateRow,
  onClearFilters,
  onImportBatch
}: QuestionTableProps) {
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTargetAttempt, setUploadTargetAttempt] = useState<'attempt1' | 'attempt2'>('attempt1');
  const [isUploading, setIsUploading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorText('');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        
        try {
          const res = await fetch('/api/parse-screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: base64Data,
              mimeType: file.type
            })
          });

          const data = await res.json();
          setIsUploading(false);

          if (data.success && data.questions && data.questions.length > 0) {
            onImportBatch(data.questions, uploadTargetAttempt);
            setIsUploadModalOpen(false);
          } else {
            setErrorText(data.error || 'Failed to extract valid question information from this image. Please try another.');
          }
        } catch (err: any) {
          setIsUploading(false);
          setErrorText('Network error: Unable to contact OCR service. Please try again.');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsUploading(false);
      setErrorText('File reading error.');
    }
    
    // Clear input so same file can be uploaded again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Apply filtering logic locally to keep it super fast
  const filteredRows = rows.filter(row => {
    const qidStr = String(row.qid || '').toLowerCase();
    const topicStr = String(row.topic || '').toLowerCase();
    const noteStr = String(row.studyGuide || '').toLowerCase();
    const matchesSearch = !filters.searchQuery || 
      qidStr.includes(filters.searchQuery.toLowerCase()) || 
      topicStr.includes(filters.searchQuery.toLowerCase()) ||
      noteStr.includes(filters.searchQuery.toLowerCase());

    const matchesSystem = !filters.systemFilter || row.system === filters.systemFilter;
    const matchesAttempt1 = !filters.attempt1Filter || row.attempt1 === filters.attempt1Filter;
    const matchesAttempt2 = !filters.attempt2Filter || row.attempt2 === filters.attempt2Filter;
    
    let matchesDateFrom = true;
    let matchesDateTo = true;
    
    if (filters.dateFrom && row.date) {
      matchesDateFrom = row.date >= filters.dateFrom;
    } else if (filters.dateFrom && (!row.date || row.date === '')) {
      matchesDateFrom = false;
    }
    
    if (filters.dateTo && row.date) {
      matchesDateTo = row.date <= filters.dateTo;
    } else if (filters.dateTo && (!row.date || row.date === '')) {
      matchesDateTo = false;
    }
    
    const matchesAttachment = !filters.hasAttachmentFilter || row.hasAttachment === true;

    return matchesSearch && matchesSystem && matchesAttempt1 && matchesAttempt2 && matchesDateFrom && matchesDateTo && matchesAttachment;
  });

  const getAttemptStyle = (attempt: string) => {
    switch (attempt) {
      case 'Correct': 
        return 'bg-[#F2F2F7] text-[#34C759] border-[#F2F2F7] focus:ring-0 focus:outline-none font-semibold';
      case 'Incorrect': 
        return 'bg-[#F2F2F7] text-[#FF383C] border-[#F2F2F7] focus:ring-0 focus:outline-none font-semibold';
      case 'Omitted': 
        return 'bg-[#F2F2F7] text-[#FF8D28] border-[#F2F2F7] focus:ring-0 focus:outline-none font-semibold';
      default: 
        return 'bg-[#F2F2F7] text-[#1C1C1E] border-[#F2F2F7] focus:ring-[#1C1C1E]';
    }
  };

  const hasActiveFilters = 
    !!filters.searchQuery || 
    !!filters.systemFilter || 
    !!filters.attempt1Filter || 
    !!filters.attempt2Filter ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    !!filters.hasAttachmentFilter;

  // Render a specific color helper for different systems to enhance visual parsing
  const getSystemBadgeStyle = (sys: string) => {
    switch (sys) {
      case 'Cardiovascular System':
        return 'bg-[#E5F0FF] text-[#0088FF] border-transparent';
      case 'Rheumatology/Orthopedics & Sports':
        return 'bg-[#E4F8EB] text-[#34C759] border-transparent';
      case 'Endocrine, Diabetes & Metabolism':
        return 'bg-[#F2F2F7] text-[#0088FF] border-transparent';
      case 'Pulmonary & Critical Care':
        return 'bg-[#FFF3E0] text-[#FF8D28] border-transparent';
      default:
        return 'bg-[#F2F2F7] text-[#1C1C1E] border-[#F2F2F7]';
    }
  };

  return (
    <div className="flex flex-col flex-1" id="question-table-main-wrapper">
      
      {/* Filtering Search Console */}
      <div className="bg-[#FFFFFF] px-5 py-4 border-b border-[#F2F2F7] flex flex-col md:flex-row items-center justify-between gap-4" id="table-search-console">
        <div className="relative w-full md:max-w-md" id="search-input-container">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1C1C1E]" size={16} />
          <input
            type="text"
            placeholder="Search QID, Topics, or Study Guides..."
            className="w-full pl-10 pr-9 py-2 border border-[#F2F2F7] rounded-xl outline-none focus:ring-2 focus:ring-[#0088FF] focus:border-[#0088FF] bg-[#F2F2F7] text-[#1C1C1E] hover:border-[#F2F2F7] transition-all text-sm  placeholder:text-[#AEAEB2]"
            value={filters.searchQuery}
            onChange={(e) => onChangeFilters({ ...filters, searchQuery: e.target.value })}
            id="search-query-field"
          />
          {filters.searchQuery && (
            <button 
              onClick={() => onChangeFilters({ ...filters, searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1C1C1E] hover:text-[#1C1C1E] cursor-pointer text-lg"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Dropdowns container */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto text-sm" id="table-select-filters-group">
          
          {/* Label indicating active count */}
          <div className="flex items-center gap-1.5 text-xs text-[#1C1C1E] font-medium pr-1" id="filter-indicator">
            <Filter size={13} className="text-[#1C1C1E]" />
            <span className="">Filters:</span>
          </div>

          {/* System Option Filter */}
          <div className="relative flex items-center">
            <select
              className={`appearance-none pl-3 pr-8 py-1.5 border rounded-xl bg-[#FFFFFF] focus:outline-none transition-all text-xs font-semibold  max-w-[180px] truncate cursor-pointer ${
                filters.systemFilter ? 'border-[#0088FF] text-[#0088FF] bg-[#0088FF]' : 'border-[#F2F2F7] text-[#1C1C1E] hover:border-[#F2F2F7]'
              }`}
              value={filters.systemFilter}
              onChange={(e) => onChangeFilters({ ...filters, systemFilter: e.target.value })}
              id="filter-system-dropdown"
            >
              <option value="">All Systems ({SYSTEM_OPTIONS.length})</option>
              {SYSTEM_OPTIONS.map((sys, idx) => (
                <option key={idx} value={sys}>{sys}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 pointer-events-none text-[#1C1C1E]" />
          </div>

          {/* Attempt 1 Filter */}
          <div className="relative flex items-center">
            <select
              className={`appearance-none pl-3 pr-8 py-1.5 border rounded-xl bg-[#FFFFFF] focus:outline-none transition-all text-xs font-semibold  cursor-pointer ${
                filters.attempt1Filter ? 'border-[#0088FF] text-[#0088FF] bg-[#0088FF]' : 'border-[#F2F2F7] text-[#1C1C1E] hover:border-[#F2F2F7]'
              }`}
              value={filters.attempt1Filter}
              onChange={(e) => onChangeFilters({ ...filters, attempt1Filter: e.target.value })}
              id="filter-attempt1-dropdown"
            >
              <option value="">1st Attempt (All)</option>
              {ATTEMPT_OPTIONS.map((opt, idx) => (
                <option key={idx} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 pointer-events-none text-[#1C1C1E]" />
          </div>

          {/* Attempt 2 Filter */}
          <div className="relative flex items-center">
            <select
              className={`appearance-none pl-3 pr-8 py-1.5 border rounded-xl bg-[#FFFFFF] focus:outline-none transition-all text-xs font-semibold  cursor-pointer ${
                filters.attempt2Filter ? 'border-[#0088FF] text-[#0088FF] bg-[#0088FF]' : 'border-[#F2F2F7] text-[#1C1C1E] hover:border-[#F2F2F7]'
              }`}
              value={filters.attempt2Filter}
              onChange={(e) => onChangeFilters({ ...filters, attempt2Filter: e.target.value })}
              id="filter-attempt2-dropdown"
            >
              <option value="">2nd Attempt (All)</option>
              {ATTEMPT_OPTIONS.map((opt, idx) => (
                <option key={idx} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 pointer-events-none text-[#1C1C1E]" />
          </div>

          {/* Date From Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-[#1C1C1E] font-medium ">From:</label>
            <input
              type="date"
              className={`px-3 py-1.5 border rounded-xl bg-[#FFFFFF] focus:outline-none transition-all text-xs font-medium cursor-pointer [color-scheme:light]  ${
                filters.dateFrom ? 'border-[#0088FF] text-[#0088FF] bg-[#0088FF]' : 'border-[#F2F2F7] text-[#1C1C1E] hover:border-[#F2F2F7]'
              }`}
              value={filters.dateFrom || ''}
              onChange={(e) => onChangeFilters({ ...filters, dateFrom: e.target.value })}
              id="filter-date-from"
            />
          </div>

          {/* Date To Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-[#1C1C1E] font-medium ">To:</label>
            <input
              type="date"
              className={`px-3 py-1.5 border rounded-xl bg-[#FFFFFF] focus:outline-none transition-all text-xs font-medium cursor-pointer [color-scheme:light]  ${
                filters.dateTo ? 'border-[#0088FF] text-[#0088FF] bg-[#0088FF]' : 'border-[#F2F2F7] text-[#1C1C1E] hover:border-[#F2F2F7]'
              }`}
              value={filters.dateTo || ''}
              onChange={(e) => onChangeFilters({ ...filters, dateTo: e.target.value })}
              id="filter-date-to"
            />
          </div>

          {/* Has Attachment Toggle */}
          <button
            onClick={() => onChangeFilters({ ...filters, hasAttachmentFilter: !filters.hasAttachmentFilter })}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl focus:outline-none transition-all text-xs font-semibold cursor-pointer ${
              filters.hasAttachmentFilter ? 'border-[#0088FF] bg-[#0088FF] text-[#FFFFFF]' : 'border-[#F2F2F7] bg-[#FFFFFF] text-[#1C1C1E] hover:bg-[#F2F2F7]'
            }`}
            title="Show only questions that have attached PDFs or files"
          >
            <Pin size={13} className={filters.hasAttachmentFilter ? 'fill-[#FFFFFF]' : 'fill-transparent text-[#8E8E93]'} />
            With Files
          </button>

          {/* Upload Screenshot Button */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-xl bg-[#0088FF] border-[#0088FF] text-[#FFFFFF] focus:outline-none transition-all text-xs font-semibold cursor-pointer shadow-sm hover:shadow-md"
            title="Upload screenshot to extract attempts"
          >
            <Plus size={14} className="text-[#FFFFFF]" />
            Screenshot
          </button>

          {/* Clear Button */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-1 text-xs text-[#FF383C] hover:text-[#FF383C] font-semibold px-3 py-1.5 bg-[#FFE5E5] hover:bg-[#FF383C] border border-transparent rounded-xl transition-colors cursor-pointer "
              id="btn-clear-active-filters"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto" id="table-scroll-container">
        <table className="w-full text-left border-collapse table-fixed min-w-[1100px]" id="step2-uq-grid">
          <thead>
            <tr className="bg-[#F2F2F7] border-b border-[#F2F2F7] text-[11px]  font-bold text-[#1C1C1E] uppercase tracking-wider select-none">
              <th className="p-4 w-[65px] text-center" id="col-head-serial">No.</th>
              <th className="p-4 w-[85px]" id="col-head-qid">QID</th>
              <th className="p-4 w-[210px]" id="col-head-topic">Topic</th>
              <th className="p-4 w-[210px]" id="col-head-system">System Category</th>
              <th className="p-2 w-[125px]" id="col-head-attempt1">1st Attempt</th>
              <th className="p-2 w-[125px]" id="col-head-attempt2">2nd Attempt</th>
              <th className="p-2 w-[130px] text-center" id="col-head-date">Date</th>
              <th className="p-4 w-[240px]" id="col-head-documents">Study Documents</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2F2F7] bg-[#FFFFFF]">
            <AnimatePresence initial={false}>
              {filteredRows.map((row) => {
                // Calculate the stable sequential serial index of the row inside the complete USMLE database
                const dbIndex = rows.findIndex(r => r.id === row.id) + 1;
                
                return (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="hover:bg-[#F2F2F7] transition-colors group relative border-b border-[#F2F2F7]"
                    id={`row-qid-item-${row.id}`}
                  >
                    {/* Column 1: Beautiful serial number */}
                    <td className="p-4 text-center  text-xs font-semibold text-gray-400">
                      {dbIndex}
                    </td>

                    {/* Column 2: Pure QID number (only the number, clean & same style as rest of database) */}
                    <td className="p-4">
                      <div className=" text-sm font-semibold text-[#1C1C1E] flex flex-col items-start gap-1">
                        <span>{row.qid}</span>
                        {row.hasAttachment && (
                          <span 
                            title="This question has an attached study PDF/Screenshot"
                            className="inline-flex items-center gap-1 text-[10px] bg-[#E5F0FF] text-[#0088FF] px-1.5 py-0.5 rounded-md border border-[#BFDBFE] shrink-0 font-bold"
                          >
                            <Pin size={10} className="fill-[#0088FF]" /> Attached
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 3: Topic */}
                    <td className="p-4">
                      <div className=" text-sm font-semibold text-[#1C1C1E] leading-snug">
                        {row.topic}
                      </div>
                    </td>

                    {/* Column 4: System Category badge */}
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border inline-block ${getSystemBadgeStyle(row.system)}`}>
                        {row.system}
                      </span>
                    </td>

                    {/* Column 5: First Attempt Dropdown */}
                    <td className="p-2">
                      <select
                        className={`w-full px-2 py-1.5 border rounded-lg focus:ring-2 focus:outline-none text-xs font-semibold  outline-none transition-all cursor-pointer ${getAttemptStyle(row.attempt1)}`}
                        value={row.attempt1}
                        onChange={(e) => onUpdateRow(row.id, 'attempt1', e.target.value)}
                      >
                        <option value="" className="bg-[#F2F2F7] text-[#1C1C1E]">-- None --</option>
                        {ATTEMPT_OPTIONS.map((opt, idx) => (
                          <option key={idx} value={opt} className="bg-[#F2F2F7] text-[#1C1C1E] ">{opt}</option>
                        ))}
                      </select>
                    </td>

                    {/* Column 6: Second Attempt Dropdown */}
                    <td className="p-2">
                      <select
                        className={`w-full px-2 py-1.5 border rounded-lg focus:ring-2 focus:outline-none text-xs font-semibold  outline-none transition-all cursor-pointer ${getAttemptStyle(row.attempt2)}`}
                        value={row.attempt2}
                        onChange={(e) => onUpdateRow(row.id, 'attempt2', e.target.value)}
                      >
                        <option value="" className="bg-[#F2F2F7] text-[#1C1C1E]">-- None --</option>
                        {ATTEMPT_OPTIONS.map((opt, idx) => (
                          <option key={idx} value={opt} className="bg-[#F2F2F7] text-[#1C1C1E] ">{opt}</option>
                        ))}
                      </select>
                    </td>

                    {/* Column 7: Date Column */}
                    <td className="p-2 text-center">
                      {row.date ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FFFFFF] border border-[#F2F2F7] rounded-md  text-xs font-medium text-[#1C1C1E] animate-fade-in">
                          <Calendar size={11} className="text-[#0088FF] shrink-0" />
                          <span>{row.date}</span>
                          <button
                            type="button"
                            onClick={() => onUpdateRow(row.id, 'date', '')}
                            className="ml-1 text-[#1C1C1E] hover:text-[#FF383C] transition-colors font-bold text-xs px-0.5"
                            title="Clear date"
                          >
                            ×
                          </button>
                        </span>
                      ) : (
                        <div className="inline-flex items-center justify-center w-full max-w-[130px]">
                          <input
                            type="date"
                            className="w-full px-2 py-1 border border-[#F2F2F7] rounded-lg bg-[#F2F2F7] text-[#1C1C1E] text-xs text-center focus:ring-1 focus:ring-[#0088FF] focus:border-[#0088FF] outline-none transition-all  cursor-pointer"
                            value=""
                            onChange={(e) => onUpdateRow(row.id, 'date', e.target.value)}
                          />
                        </div>
                      )}
                    </td>

                    {/* Column 8: Dynamic Document/Materials Folder column */}
                    <td className="p-3">
                      <StudyMaterialsCell 
                        qid={row.qid} 
                        onUpdateStudyGuide={(text) => onUpdateRow(row.id, 'studyGuide', text)}
                        onUpdateAttachmentStatus={(hasAttachment) => {
                           if (row.hasAttachment !== hasAttachment) {
                              onUpdateRow(row.id, 'hasAttachment', hasAttachment);
                           }
                        }}
                      />
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>

            {filteredRows.length === 0 && (
              <tr id="empty-table-state-row">
                <td colSpan={8} className="py-12 text-center text-[#1C1C1E]">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto animate-fade-in" id="empty-state-notice">
                    <HelpCircle size={32} className="text-[#AEAEB2] mb-3" />
                    <h3 className="text-sm font-semibold text-[#1C1C1E] ">No Match Found</h3>
                    <p className="text-xs text-[#1C1C1E] mt-1 ">
                      No questions correspond to your active query or topic filter. Clear selections below to reset.
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={onClearFilters}
                        className="mt-4 px-3.5 py-1.5 bg-[#0088FF] text-[#1C1C1E] text-xs font-semibold rounded-lg hover:bg-[#0088FF] transition-colors shadow-xs cursor-pointer "
                        id="btn-empty-clear-all"
                      >
                        Reset Active Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Screenshot Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1C1C1E]/40 backdrop-blur-sm"
            onClick={() => !isUploading && setIsUploadModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#FFFFFF] w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-[#F2F2F7]"
            >
              <div className="flex items-center justify-between p-4 border-b border-[#F2F2F7]">
                <h3 className="font-semibold px-1 flex items-center gap-2">
                  <UploadCloud size={18} className="text-[#0088FF]" />
                  Upload Screenshot
                </h3>
                <button 
                  onClick={() => !isUploading && setIsUploadModalOpen(false)}
                  className="p-1 hover:bg-[#F2F2F7] rounded-full transition-colors"
                  disabled={isUploading}
                >
                  <X size={18} className="text-[#8E8E93]" />
                </button>
              </div>

              <div className="p-6">
                <p className="text-sm text-[#1C1C1E] mb-5 leading-relaxed">
                  Upload a screenshot of your exam or UWorld block results. The AI will automatically extract QIDs, systems, and scores.
                </p>

                <div className="mb-6">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E8E93] mb-2">
                    Target Attempt Column
                  </label>
                  <div className="flex bg-[#F2F2F7] p-1 rounded-xl">
                    <button
                      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${uploadTargetAttempt === 'attempt1' ? 'bg-[#FFFFFF] text-[#0088FF] shadow-sm' : 'text-[#8E8E93] hover:text-[#1C1C1E]'}`}
                      onClick={() => setUploadTargetAttempt('attempt1')}
                    >
                      1st Attempt
                    </button>
                    <button
                      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${uploadTargetAttempt === 'attempt2' ? 'bg-[#FFFFFF] text-[#0088FF] shadow-sm' : 'text-[#8E8E93] hover:text-[#1C1C1E]'}`}
                      onClick={() => setUploadTargetAttempt('attempt2')}
                    >
                      2nd Attempt
                    </button>
                  </div>
                </div>

                {errorText && (
                  <div className="mb-5 p-3 bg-[#FFE5E5] border border-[#FF383C]/20 rounded-xl">
                    <p className="text-xs text-[#FF383C] font-semibold">{errorText}</p>
                  </div>
                )}

                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-[#0088FF]/30 bg-[#0088FF]/5 hover:bg-[#0088FF]/10 hover:border-[#0088FF]/50 transition-colors rounded-xl outline-none"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={32} className="text-[#0088FF] animate-spin" />
                      <div className="text-center font-medium text-sm text-[#0088FF]">
                        Analyzing Screenshot...
                      </div>
                      <div className="text-xs text-[#0088FF]/70 mt-1 max-w-[200px] text-center">
                        This usually takes 8-10 seconds depending on image complexity.
                      </div>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={32} className="text-[#0088FF]" />
                      <span className="font-semibold text-sm text-[#0088FF]">Select Image File</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
