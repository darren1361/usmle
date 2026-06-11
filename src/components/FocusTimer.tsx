import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, Clock } from 'lucide-react';

export default function FocusTimer() {
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  
  const [dailyFocusTokens, setDailyFocusTokens] = useState<number>(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load today's focus time
    const today = new Date().toLocaleDateString('en-CA');
    const saved = localStorage.getItem(`focus_time_${today}`);
    if (saved) {
      setDailyFocusTokens(parseInt(saved, 10));
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode]);

  const handleSessionComplete = () => {
    setIsRunning(false);
    if (mode === 'focus') {
      // Add 25 mins
      const today = new Date().toLocaleDateString('en-CA');
      const saved = localStorage.getItem(`focus_time_${today}`);
      const current = saved ? parseInt(saved, 10) : 0;
      const updated = current + 25;
      localStorage.setItem(`focus_time_${today}`, updated.toString());
      setDailyFocusTokens(updated);
      
      // Auto-switch to break
      setMode('break');
      setTimeLeft(5 * 60);
    } else {
      // Break done, switch to focus
      setMode('focus');
      setTimeLeft(25 * 60);
    }
    
    // Attempt to notify user
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(mode === 'focus' ? "Focus session complete! Time for a break." : "Break is over, back to focus!");
    } else if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  };

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
  };

  const switchMode = (newMode: 'focus' | 'break') => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(newMode === 'focus' ? 25 * 60 : 5 * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  const displayTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="bg-[#FFCC00] p-5 rounded-[28px] flex flex-col justify-between h-full border border-transparent">
      <div>
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-[16px] font-bold text-[#000000]">
            Pomodoro Timer
          </h3>
          <span className="p-2.5 bg-black/10 text-[#000000] rounded-xl">
            <Clock size={18} />
          </span>
        </div>

        <div className="mb-2 text-center">
          <div className="flex justify-center gap-2 mb-1">
            <button disabled={isRunning && mode !== 'focus'} onClick={() => switchMode('focus')} className={`px-3 py-1 rounded-full text-[16px] font-bold transition-colors border ${mode === 'focus' ? 'bg-[#000000] text-[#FFCC00] border-transparent' : 'bg-transparent border-transparent text-[#000000] hover:text-[#000000]'}`}>
              25m Focus
            </button>
            <button disabled={isRunning && mode !== 'break'} onClick={() => switchMode('break')} className={`px-3 py-1 rounded-full text-[16px] font-bold transition-colors border ${mode === 'break' ? 'bg-[#000000] text-[#FFCC00] border-transparent' : 'bg-transparent border-transparent text-[#000000] hover:text-[#000000]'}`}>
              5m Break
            </button>
          </div>
          
          <div className="py-1">
            <div className="text-[36px] font-bold text-[#000000]">
              {displayTime}
            </div>
          </div>
          
          {/* Progress Bar for Current Timer */}
          <div className="w-full bg-black/20 h-1.5 rounded-full mt-1 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 bg-[#000000]`}
              style={{ width: `${((mode === 'focus' ? 25 * 60 : 5 * 60) - timeLeft) / (mode === 'focus' ? 25 * 60 : 5 * 60) * 100}%` }}
            />
          </div>
          
          <div className="flex justify-center gap-3 mt-2">
            <button onClick={toggleTimer} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isRunning ? 'bg-black/20 text-[#000000]' : 'bg-[#000000] text-[#FFCC00]'}`}>
              {isRunning ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
            </button>
            <button onClick={resetTimer} className="w-10 h-10 rounded-full flex items-center justify-center bg-black/10 text-[#000000] transition-colors">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div>
          <p className="text-[16px] font-bold mb-1 text-center text-[#000000]">Today's Deep Work</p>
          <div className="flex justify-center items-end gap-1 ">
            <span className="text-[16px] font-bold text-[#000000]">{dailyFocusTokens}</span>
            <span className="text-[16px] font-bold text-[#000000] mb-1">mins</span>
          </div>
        </div>
      </div>
    </div>
  );
}
