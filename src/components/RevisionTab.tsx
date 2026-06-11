import React, { useState, useEffect } from 'react';
import { USMLERow } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RefreshCw, AudioLines, Layers, Loader2 } from 'lucide-react';
import { generateFlashcards, generatePodcast } from '../services/revisionApi';

import { uploadAudioToParentFolder, getAccessToken } from '../services/googleDrive';

interface RevisionTabProps {
  rows: USMLERow[];
}

export default function RevisionTab({ rows }: RevisionTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'flashcards' | 'podcast'>('flashcards');

  // Find incorrect questions from today or just general incorrect questions
  const todayStr = new Date().toLocaleDateString('en-CA');
  
  // Use all incorrect questions if none are found for today just for revision sake
  let targetQuestions = rows.filter(r => (r.date === todayStr && (r.attempt1 === 'Incorrect' || r.attempt2 === 'Incorrect')));
  if (targetQuestions.length === 0) {
     targetQuestions = rows.filter(r => r.attempt1 === 'Incorrect' || r.attempt2 === 'Incorrect');
  }

  // State for Cards
  const [cards, setCards] = useState<any[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // State for Podcast
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [podcastScript, setPodcastScript] = useState<any[]>([]);
  const [loadingPodcast, setLoadingPodcast] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const fetchCards = async () => {
    if (targetQuestions.length === 0) return;
    setLoadingCards(true);
    try {
      const data = await generateFlashcards(targetQuestions);
      if (data.success && data.cards) {
        setCards(data.cards);
        setCurrentCardIndex(0);
        setShowAnswer(false);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingCards(false);
  };

  const fetchPodcast = async () => {
    if (targetQuestions.length === 0) return;
    setLoadingPodcast(true);
    setSyncStatus('idle');
    try {
      const data = await generatePodcast(targetQuestions);
      if (data.success && data.audioBase64) {
        const audioSrcUrl = `data:${data.mimeType};base64,${data.audioBase64}`;
        setAudioUrl(audioSrcUrl);
        setPodcastScript(data.script || []);

        // Optional: Save to drive automatically
        const token = getAccessToken();
        if (token) {
          setSyncStatus('saving');
          try {
            const byteCharacters = atob(data.audioBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: data.mimeType });
            const docDate = new Date().toISOString().split('T')[0];
            const file = new File([blob], `Revision_Podcast_${docDate}.wav`, { type: data.mimeType });

            await uploadAudioToParentFolder(file, token);
            console.log("Audio successfully saved to Google Drive 'Study Material' folder!");
            setSyncStatus('saved');
          } catch(err) {
            console.error("Failed to save audio to Google Drive", err);
            setSyncStatus('error');
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingPodcast(false);
  };

  const togglePlaySync = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Flip card
  const flipCard = () => setShowAnswer(!showAnswer);
  
  // Next card
  const nextCard = () => {
    setShowAnswer(false);
    setCurrentCardIndex(prev => (prev + 1) % cards.length);
  };

  // Previous card
  const prevCard = () => {
    setShowAnswer(false);
    setCurrentCardIndex(prev => (prev - 1 + cards.length) % cards.length);
  };

  return (
    <div className="bg-transparent border-b border-[#F2F2F7] p-5 md:p-6" id="revision-tab-container">
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-4 mb-6 border-b border-[#F2F2F7] pb-2">
          <button
            onClick={() => setActiveSubTab('flashcards')}
            className={`font-semibold transition-colors \${activeSubTab === 'flashcards' ? 'text-[#0088FF]' : 'text-[#1C1C1E] hover:text-[#1C1C1E]'}`}
          >
            <Layers className="inline-block mr-2" size={16} /> Flashcards
          </button>
          <button
            onClick={() => setActiveSubTab('podcast')}
            className={`font-semibold transition-colors \${activeSubTab === 'podcast' ? 'text-[#0088FF]' : 'text-[#1C1C1E] hover:text-[#1C1C1E]'}`}
          >
            <AudioLines className="inline-block mr-2" size={16} /> Audio Podcast
          </button>
        </div>

        {targetQuestions.length === 0 ? (
          <div className="p-8 text-center bg-[#FFFFFF] border border-[#F2F2F7] rounded-2xl">
            <h3 className="text-[#1C1C1E] font-semibold mb-2">No Incorrect Questions Found</h3>
            <p className="text-[#1C1C1E] text-sm">Please log some incorrect questions in the Tracker first.</p>
          </div>
        ) : (
          <div>
            {activeSubTab === 'flashcards' && (
              <div className="animate-fade-in flex flex-col items-center">
                {cards.length === 0 && !loadingCards && (
                  <button onClick={fetchCards} className="bg-[#0088FF] hover:bg-[#0088FF] text-[#FFFFFF] px-6 py-3.5 rounded-2xl font-semibold transition-all shadow-sm">
                    Generate Anki Cards
                  </button>
                )}
                {loadingCards && (
                  <div className="flex items-center gap-3 text-[#1C1C1E] py-10">
                    <Loader2 className="animate-spin" size={24} /> Generating Cards with Gemini...
                  </div>
                )}
                {cards.length > 0 && (
                  <div className="w-full max-w-lg perspective-1000 mt-4">
                     <p className="text-center text-sm font-semibold text-[#1C1C1E] mb-3">Card {currentCardIndex + 1} of {cards.length}</p>
                     
                     <div 
                       onClick={flipCard}
                       className="relative w-full h-[280px] bg-[#FFFFFF] border border-[#F2F2F7] rounded-2xl p-6 cursor-pointer flex flex-col justify-center items-center text-center shadow-lg transition-transform hover:scale-[1.02]"
                     >
                        <AnimatePresence mode="wait">
                          {!showAnswer ? (
                            <motion.div
                              key="front"
                              initial={{ opacity: 0, rotateY: 180 }}
                              animate={{ opacity: 1, rotateY: 0 }}
                              exit={{ opacity: 0, rotateY: -180 }}
                              transition={{ duration: 0.3 }}
                              className="absolute inset-x-6 inset-y-6 flex flex-col justify-center"
                            >
                               <span className="text-[10px] uppercase font-mono font-bold text-[#FF8D28] mb-3 block tracking-widest">{cards[currentCardIndex]?.topic} • QID {cards[currentCardIndex]?.qid}</span>
                               <h3 className="text-lg md:text-xl font-sans font-medium text-[#1C1C1E] leading-snug">
                                 {cards[currentCardIndex]?.front}
                               </h3>
                               <p className="text-[#1C1C1E] text-xs mt-6 absolute bottom-0 left-0 right-0">Click to flip</p>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="back"
                              initial={{ opacity: 0, rotateY: -180 }}
                              animate={{ opacity: 1, rotateY: 0 }}
                              exit={{ opacity: 0, rotateY: 180 }}
                              transition={{ duration: 0.3 }}
                              className="absolute inset-x-6 inset-y-6 flex flex-col justify-center"
                            >
                               <h3 className="text-lg md:text-xl font-sans font-bold text-[#34C759] leading-snug mb-3">
                                 Answer
                               </h3>
                               <p className="text-sm text-[#1C1C1E] leading-relaxed">
                                 {cards[currentCardIndex]?.back}
                               </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                     </div>
                     
                     <div className="flex justify-between items-center mt-6">
                       <button onClick={prevCard} className="px-4 py-2 bg-[#F2F2F7] text-[#1C1C1E] rounded-lg text-sm font-semibold hover:bg-[#F2F2F7]">Previous</button>
                       <button onClick={fetchCards} className="text-[#0088FF] text-xs font-semibold flex items-center gap-1 hover:text-[#0088FF]"><RefreshCw size={12} /> Regenerate</button>
                       <button onClick={nextCard} className="px-6 py-2 bg-[#0088FF] text-[#FFFFFF] border border-transparent rounded-lg text-sm font-semibold hover:bg-[#0088FF]">Next Card</button>
                     </div>
                  </div>
                )}
              </div>
            )}
            
            {activeSubTab === 'podcast' && (
              <div className="animate-fade-in flex flex-col pt-2 max-w-2xl mx-auto">
                 {(!audioUrl && !loadingPodcast) && (
                    <div className="text-center bg-[#FFFFFF] border border-[#F2F2F7] rounded-2xl p-10">
                      <h3 className="text-lg font-semibold text-[#1C1C1E] mb-2">Morning Run Audio Script</h3>
                      <p className="text-[#1C1C1E] text-sm mb-6 leading-relaxed">
                        Generate a customized 2-minute podcast discussion covering your specific wrong questions. Two AI hosts will break down the clinical pearls and mnemonics for you.
                      </p>
                      <button onClick={fetchPodcast} className="bg-[#0088FF] hover:bg-[#0088FF] text-[#1C1C1E] px-6 py-2 rounded-xl font-semibold transition-all inline-flex items-center gap-2">
                        <AudioLines size={18} /> Generate Audio
                      </button>
                    </div>
                 )}
                 {loadingPodcast && (
                   <div className="flex items-center justify-center gap-3 text-[#0088FF] py-10">
                     <Loader2 className="animate-spin" size={24} /> Assembling Podcast Segment... (takes ~10-20 seconds)
                   </div>
                 )}
                 {(audioUrl) && (
                   <div className="bg-[#FFFFFF] p-6 rounded-2xl border border-[#F2F2F7]">
                     <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-lg font-semibold text-[#1C1C1E] flex items-center gap-2">
                             <AudioLines className="text-[#0088FF]" /> Daily Clinical Summary
                          </h3>
                          <p className="text-xs text-[#1C1C1E] mt-1">AI Presenters: Dr. Jane & Joe</p>
                        </div>
                        <button 
                           onClick={togglePlaySync}
                           className="w-12 h-12 rounded-full bg-[#0088FF] hover:bg-[#0088FF] flex items-center justify-center text-[#1C1C1E]"
                        >
                           {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                        </button>
                     </div>
                     
                     {/* The audio element */}
                     <audio 
                       ref={audioRef} 
                       src={audioUrl} 
                       onEnded={() => setIsPlaying(false)}
                       onPause={() => setIsPlaying(false)}
                       onPlay={() => setIsPlaying(true)}
                       className="hidden" 
                     />
                     <div className="mb-4">
                        <div className="flex justify-between items-center text-xs text-[#1C1C1E] mb-2 font-mono">
                           <span>Transcript</span>
                           <div className="flex items-center gap-3">
                             {syncStatus === 'saving' && <span className="text-[#1C1C1E] flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Syncing to Drive...</span>}
                             {syncStatus === 'saved' && <span className="text-[#34C759]">✓ Saved to Google Drive</span>}
                             {syncStatus === 'error' && <span className="text-[#FF383C]">✗ Failed to save</span>}
                             <button onClick={fetchPodcast} className="text-[#0088FF] hover:text-[#0088FF] flex items-center gap-1">
                               <RefreshCw size={12} /> Regenerate
                             </button>
                           </div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto pr-2 flex flex-col gap-3 custom-scrollbar">
                           {podcastScript.map((turn, i) => (
                             <div key={i} className={`p-3 rounded-xl text-sm leading-relaxed \${turn.speaker === 'Jane' ? 'bg-[#0088FF] border border-[#0088FF] ml-4' : 'bg-[#F2F2F7] border border-[#F2F2F7] mr-4'}`}>
                               <strong className={`block text-xs mb-1 \${turn.speaker === 'Jane' ? 'text-[#0088FF]' : 'text-[#1C1C1E]'}`}>{turn.speaker}</strong>
                               <span className="text-[#1C1C1E]">{turn.text}</span>
                             </div>
                           ))}
                        </div>
                     </div>
                   </div>
                 )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
