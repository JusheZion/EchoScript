/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { TranscriptionResponse, Emotion } from '../types';
import { User, Clock, Globe, Languages, Smile, Frown, AlertCircle, Meh, Search, X } from 'lucide-react';

interface TranscriptionDisplayProps {
  data: TranscriptionResponse;
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({ data }) => {
  const [highlightedSpeaker, setHighlightedSpeaker] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const parseTime = (timeStr: string) => {
    const parts = timeStr.trim().split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const timelineData = data.segments.map((seg, i) => {
    const times = seg.timestamp.split('-').map(t => t.trim());
    let start = parseTime(times[0]);
    let end = times.length > 1 ? parseTime(times[1]) : null;

    if (end === null) {
      if (i < data.segments.length - 1) {
        const nextTimes = data.segments[i+1].timestamp.split('-').map(t => t.trim());
        end = parseTime(nextTimes[0]);
      } else {
        end = start + 5;
      }
    }
    
    if (end <= start) end = start + 1;
    
    return { speaker: seg.speaker, start, end, duration: end - start, originalTimestamp: seg.timestamp };
  });

  const maxEnd = timelineData.length > 0 ? Math.max(...timelineData.map(d => d.end)) : 1;
  const finalTotalDuration = maxEnd > 0 ? maxEnd : 1;

  const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-purple-500'];
  const speakerColors: Record<string, string> = {};
  let colorIndex = 0;
  
  data.segments.forEach(seg => {
    if (!speakerColors[seg.speaker]) {
      speakerColors[seg.speaker] = colors[colorIndex % colors.length];
      colorIndex++;
    }
  });

  const getEmotionBadge = (emotion?: Emotion) => {
    if (!emotion) return null;

    switch (emotion) {
      case Emotion.Happy:
        return (
          <div className="flex items-center bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded border border-green-100 dark:border-green-800">
            <Smile size={14} className="mr-1.5" />
            {emotion}
          </div>
        );
      case Emotion.Sad:
        return (
          <div className="flex items-center bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded border border-blue-100 dark:border-blue-800">
            <Frown size={14} className="mr-1.5" />
            {emotion}
          </div>
        );
      case Emotion.Angry:
        return (
          <div className="flex items-center bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded border border-red-100 dark:border-red-800">
            <AlertCircle size={14} className="mr-1.5" />
            {emotion}
          </div>
        );
      case Emotion.Neutral:
      default:
        return (
          <div className="flex items-center bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded border border-slate-200 dark:border-slate-600">
            <Meh size={14} className="mr-1.5" />
            {emotion}
          </div>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Summary Section */}
      <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 border border-indigo-100 dark:border-slate-700 rounded-2xl p-6 shadow-sm transition-colors duration-300">
        <h2 className="text-lg font-semibold text-indigo-900 dark:text-indigo-200 mb-3">Summary</h2>
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{data.summary}</p>
      </div>

      {/* Timeline Section */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm transition-colors duration-300">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Speaker Distribution</h2>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4">
          {Object.entries(speakerColors).map(([speaker, color]) => (
            <button 
              key={speaker}
              onClick={() => setHighlightedSpeaker(highlightedSpeaker === speaker ? null : speaker)}
              className={`flex items-center text-sm font-medium transition-opacity ${highlightedSpeaker && highlightedSpeaker !== speaker ? 'opacity-50' : 'opacity-100 hover:opacity-80'}`}
            >
              <div className={`w-3.5 h-3.5 rounded-full mr-2 ${color}`}></div>
              <span className="text-slate-700 dark:text-slate-300">{speaker}</span>
            </button>
          ))}
        </div>

        {/* Timeline Bar */}
        <div className="w-full h-8 bg-slate-100 dark:bg-slate-700/50 rounded-lg overflow-hidden relative border border-slate-200 dark:border-slate-600">
          {timelineData.map((seg, i) => {
            const isHighlighted = highlightedSpeaker === null || highlightedSpeaker === seg.speaker;
            return (
              <div 
                key={i}
                className={`absolute h-full ${speakerColors[seg.speaker] || 'bg-slate-500'} border-r border-white/30 dark:border-slate-900/30 transition-all duration-300 hover:brightness-110 ${isHighlighted ? 'opacity-100' : 'opacity-20 grayscale'}`}
                style={{ 
                  left: `${(seg.start / finalTotalDuration) * 100}%`,
                  width: `${(seg.duration / finalTotalDuration) * 100}%` 
                }}
                title={`${seg.speaker} (${seg.originalTimestamp})`}
                onClick={() => setHighlightedSpeaker(highlightedSpeaker === seg.speaker ? null : seg.speaker)}
                role="button"
              />
            );
          })}
        </div>
      </div>

      {/* Segments Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Detailed Transcript</h2>
          
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search transcript..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-slate-200 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        
        {data.segments.filter(segment => 
          segment.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
          segment.speaker.toLowerCase().includes(searchQuery.toLowerCase())
        ).map((segment, index) => {
          const isHighlighted = highlightedSpeaker === segment.speaker;
          const isFaded = highlightedSpeaker !== null && !isHighlighted;
          
          return (
          <div 
            key={index} 
            className={`bg-white dark:bg-slate-800 border rounded-xl p-5 transition-all duration-300 ${
              isHighlighted 
                ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900 shadow-md' 
                : 'border-slate-200 dark:border-slate-700 hover:shadow-md'
            } ${isFaded ? 'opacity-50 grayscale-[50%]' : 'opacity-100'}`}
          >
            <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-slate-500 dark:text-slate-400">
              <button 
                onClick={() => setHighlightedSpeaker(isHighlighted ? null : segment.speaker)}
                className={`flex items-center font-semibold px-2 py-1 rounded transition-colors ${
                  isHighlighted 
                    ? 'text-indigo-700 dark:text-indigo-200 bg-indigo-100 dark:bg-indigo-900/60 ring-1 ring-indigo-300 dark:ring-indigo-700' 
                    : 'text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                }`}
                title="Click to highlight speaker"
              >
                <User size={14} className="mr-1.5" />
                {segment.speaker}
              </button>
              <div className="flex items-center bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                <Clock size={14} className="mr-1.5" />
                {segment.timestamp}
              </div>
              <div className="flex items-center bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                <Globe size={14} className="mr-1.5" />
                {segment.language}
              </div>
              {segment.emotion && getEmotionBadge(segment.emotion)}
            </div>
            
            <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
              {segment.content}
            </p>

            {segment.translation && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 -mx-5 -mb-5 px-5 pb-5 rounded-b-xl">
                 <div className="flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-300 mb-1.5 uppercase tracking-wide pt-2">
                    <Languages size={14} className="mr-1.5" />
                    English Translation
                 </div>
                 <p className="text-slate-600 dark:text-slate-400 italic leading-relaxed">
                   {segment.translation}
                 </p>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default TranscriptionDisplay;