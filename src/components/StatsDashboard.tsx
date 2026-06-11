import { useState, useMemo } from 'react';
import { RefreshCcw, Calendar } from 'lucide-react';
import { USMLERow } from '../types';
import FocusTimer from './FocusTimer';

interface StatsDashboardProps {
  rows: USMLERow[];
  onSelectSystemFilter: (system: string) => void;
  activeSystemFilter: string;
}

export default function StatsDashboard({ rows }: StatsDashboardProps) {
  const studyTaskProgress = useMemo(() => {
    const today = new Date();
    const dayStr = today.toLocaleDateString('en-CA');
    const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon, etc.
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const mondayDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayDiff);
    const thisMondayStr = monday.toLocaleDateString('en-CA');

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const daysData = weekDays.map((name, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);
      const dateStr = d.toLocaleDateString('en-CA');
      const count = rows.filter(r => r.date === dateStr && (r.attempt1 || r.attempt2 || r.studyGuide)).length;
      return {
        name, dateStr, count, isToday: dateStr === dayStr, percent: Math.min(100, (count / 40) * 100), isCompleted: count >= 40
      };
    });

    const activeTodayData = daysData.find(d => d.isToday) || {
      name: isWeekend ? (dayOfWeek === 6 ? 'Sat' : 'Sun') : 'Today', dateStr: dayStr,
      count: rows.filter(r => r.date === dayStr && (r.attempt1 || r.attempt2 || r.studyGuide)).length,
      isToday: true, isCompleted: rows.filter(r => r.date === dayStr && (r.attempt1 || r.attempt2 || r.studyGuide)).length >= 40
    };

    const weekCompletedDaysCount = daysData.filter(d => d.isCompleted).length;

    const effectiveDateStr = thisMondayStr;
    const rowsByDate = rows.reduce((acc, row) => {
      if (row.date && row.date >= effectiveDateStr && (row.attempt1 || row.attempt2 || row.studyGuide)) {
        acc[row.date] = (acc[row.date] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const weekStats: Record<string, number> = {};
    let earliestMondayStr = thisMondayStr;

    Object.keys(rowsByDate).forEach(date => {
      const [y, m, dstr] = date.split('-');
      const d = new Date(parseInt(y), parseInt(m) - 1, parseInt(dstr));
      if (!isNaN(d.getTime())) {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff); // Shift to Monday
        const mStr = d.toLocaleDateString('en-CA');
        
        // Only calculate stats starting from key effective week
        if (mStr >= effectiveDateStr) {
          weekStats[mStr] = (weekStats[mStr] || 0) + rowsByDate[date];
          if (mStr < earliestMondayStr) earliestMondayStr = mStr;
        }
      }
    });

    let iter = new Date(`${earliestMondayStr}T12:00:00`);
    let currentDeficit = 0;
    while (true) {
      const wStr = iter.toLocaleDateString('en-CA');
      if (wStr >= thisMondayStr) break;
      const completed = weekStats[wStr] || 0;
      const target = 200 + currentDeficit;
      if (completed < target) {
        currentDeficit = target - completed;
      } else {
        currentDeficit = 0;
      }
      iter.setDate(iter.getDate() + 7);
    }

    const currentWeekTarget = 200 + currentDeficit;
    const currentWeekCompleted = weekDays.reduce((sum, _, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);
      return sum + (rowsByDate[d.toLocaleDateString('en-CA')] || 0);
    }, 0);

    let requiredDailyToPace = 0;
    if (currentWeekCompleted < currentWeekTarget) {
      const todayCount = activeTodayData.count;
      const previousDaysCompleted = currentWeekCompleted - todayCount;
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const daysToFriday = 6 - dayOfWeek;
        requiredDailyToPace = Math.ceil((currentWeekTarget - previousDaysCompleted) / daysToFriday);
      } else {
        const daysToSunday = dayOfWeek === 6 ? 2 : 1; 
        requiredDailyToPace = Math.ceil((currentWeekTarget - previousDaysCompleted) / daysToSunday);
      }
    }

    return {
      days: daysData,
      todayData: activeTodayData,
      isWeekend,
      dayOfWeek,
      weekCompletedDaysCount,
      dayStr,
      weekly: {
        completed: currentWeekCompleted,
        target: currentWeekTarget,
        carryOver: currentDeficit,
        requiredDailyToPace
      }
    };
  }, [rows]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch bg-transparent w-full h-full">
      
      {/* Daily Target Section */}
      <div className="bg-[#007AFF] p-5 rounded-[28px] flex flex-col justify-between border border-transparent">
        <div>
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-[16px] font-bold text-[#FFFFFF]">
              Daily Question Goal
            </h3>
            <span className="p-2 bg-[#FFFFFF] text-[#007AFF] rounded-full">
              <Calendar size={16} />
            </span>
          </div>
          <div className="mt-4 mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">
                {studyTaskProgress.todayData.count} 
              </span>
              <span className="text-[36px] font-medium tracking-tight text-[#FFFFFF] opacity-90">
                / 40
              </span>
            </div>
            <div className="w-full bg-white/20 h-2.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full transition-all duration-500 bg-[#FFFFFF]"
                style={{ width: `${Math.min(100, (studyTaskProgress.todayData.count / 40) * 100)}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mt-6">
            {studyTaskProgress.days.map((day, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-[#FFFFFF] font-bold">
                  {day.name.charAt(0)}
                </span>
                <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all ${
                  day.isCompleted ? 'bg-[#FFFFFF] text-[#007AFF]' : day.count > 0 ? 'bg-white/40 text-[#FFFFFF]' : 'bg-white/20 text-[#FFFFFF]'
                } ${day.isToday ? 'ring-2 ring-offset-2 ring-[#FFFFFF] ring-offset-[#007AFF]' : ''}`}>
                  <span className="text-[10px] font-bold text-center pl-[1px]">
                    {day.isCompleted ? '✓' : day.count > 0 ? day.count : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      
      {/* Weekly Target Section */}
      <div className="bg-[#5856D6] p-5 rounded-[28px] flex flex-col justify-between border border-transparent">
        <div>
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-[16px] font-bold text-[#FFFFFF]">
              Weekly Question Goal
            </h3>
            <span className="p-2 bg-[#FFFFFF] text-[#5856D6] rounded-full">
              <RefreshCcw size={16} />
            </span>
          </div>
          <div className="mt-4 mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">
                {studyTaskProgress.weekly.completed} 
              </span>
              <span className="text-[36px] font-medium tracking-tight text-[#FFFFFF] opacity-90">
                / {studyTaskProgress.weekly.target}
              </span>
            </div>
            <div className="w-full bg-white/20 h-2.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full transition-all duration-500 bg-[#FFFFFF]"
                style={{ width: `${Math.min(100, (studyTaskProgress.weekly.completed / studyTaskProgress.weekly.target) * 100)}%` }}
              />
            </div>
          </div>
          <div className="mt-6">
            {studyTaskProgress.weekly.completed >= studyTaskProgress.weekly.target ? (
              <span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">
                Goal met
              </span>
            ) : (
              <span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">
                {studyTaskProgress.weekly.target - studyTaskProgress.weekly.completed} <span className="text-[16px] font-bold opacity-90">more needed</span>
              </span>
            )}
          </div>
        </div>
      </div>

      
      {/* Dynamic Required Daily Progress Section */}
      <div className="bg-[#FF2D55] p-5 rounded-[28px] flex flex-col justify-between border border-transparent">
        <div>
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-[16px] font-bold text-[#FFFFFF]">
              Required Pacing
            </h3>
            <span className="p-2 bg-[#FFFFFF] text-[#FF2D55] rounded-full">
              <RefreshCcw size={16} />
            </span>
          </div>
          <div className="mt-4 mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">
                {studyTaskProgress.todayData.count} 
              </span>
              <span className="text-[36px] font-medium tracking-tight text-[#FFFFFF] opacity-90">
                / {studyTaskProgress.weekly.requiredDailyToPace || 0}
              </span>
            </div>
            <div className="w-full bg-white/20 h-2.5 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 bg-[#FFFFFF]`}
                style={{ width: `${Math.min(100, studyTaskProgress.weekly.requiredDailyToPace ? ((studyTaskProgress.todayData.count / studyTaskProgress.weekly.requiredDailyToPace) * 100) : 100)}%` }}
              />
            </div>
          </div>
          <div className="mt-6">
            {studyTaskProgress.weekly.completed >= studyTaskProgress.weekly.target ? (
              <span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">
                Pacing disabled
              </span>
            ) : (
              studyTaskProgress.weekly.requiredDailyToPace && studyTaskProgress.todayData.count >= studyTaskProgress.weekly.requiredDailyToPace ? (
                <span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">
                  Daily pace matched!
                </span>
              ) : (
                <span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">
                  {Math.max(0, (studyTaskProgress.weekly.requiredDailyToPace || 0) - studyTaskProgress.todayData.count)} <span className="text-[16px] font-bold opacity-90">more to stay on track</span>
                </span>
              )
            )}
          </div>
        </div>
      </div>
    
      <div className="flex flex-col h-full rounded-[28px]">
        <FocusTimer />
      </div>
      
      
    </div>
  );
}
