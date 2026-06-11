/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Stethoscope } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-[#FFFFFF] backdrop-blur border-b border-[#F2F2F7] text-[#1C1C1E] rounded-t-3xl overflow-hidden shadow-sm animate-fade-in" id="app-header-container">
      
      <div className="p-6 md:p-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6" id="header-content-flex">
        {/* Logo and Titles */}
        <div className="flex items-center gap-4" id="header-brand">
          <div className="p-3 bg-[#F2F2F7] border border-[#F2F2F7] rounded-2xl text-[#0088FF] shadow-sm" id="brand-badge-icon">
            <Stethoscope size={28} />
          </div>
          <div id="brand-titles">
            <div className="flex items-center gap-2 flex-wrap" id="header-badge-row">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#F2F2F7] text-[#1C1C1E] rounded-full">
                UWorld Review
              </span>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#FFF2E5] text-[#FF8D28] rounded-full">
                Step 2 CK
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1C1C1E] mt-1.5" id="app-main-heading">
              USMLE Step 2 CK Tracker
            </h1>
            <p className="text-[#1C1C1E] text-xs md:text-sm mt-0.5 font-medium" id="app-sub-heading">
              Chronicle study weaknesses, track diagnostic repetitions, and refine system key-takeaways.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}