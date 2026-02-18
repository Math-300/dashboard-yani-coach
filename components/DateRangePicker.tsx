import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, Clock } from 'lucide-react';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date) => void;
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
};

const toInputFormat = (date: Date) => {
  return date.toISOString().split('T')[0];
};

const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState(toInputFormat(startDate));
  const [tempEnd, setTempEnd] = useState(toInputFormat(endDate));
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update temp state when props change or menu opens
  useEffect(() => {
    if (isOpen) {
      setTempStart(toInputFormat(startDate));
      setTempEnd(toInputFormat(endDate));
    }
  }, [isOpen, startDate, endDate]);

  const applyPreset = (type: 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'last_6_months') => {
    const now = new Date();
    let newStart = new Date();
    let newEnd = new Date();
    
    // Default End is end of today
    newEnd.setHours(23, 59, 59, 999);
    newStart.setHours(0, 0, 0, 0);

    switch (type) {
      case 'today':
        // Start and End are today
        break;
      case 'yesterday':
        // Safe subtraction
        newStart.setDate(now.getDate() - 1);
        newEnd = new Date(newStart);
        newEnd.setHours(23, 59, 59, 999);
        break;
      case 'week':
        // Last 7 days
        newStart.setDate(now.getDate() - 7);
        break;
      case 'month':
        // First day of current month
        newStart = new Date(now.getFullYear(), now.getMonth(), 1);
        newStart.setHours(0,0,0,0);
        break;
      case 'last_month':
        // First day of previous month (Safe Constructor handles year rollover automatically)
        newStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        newStart.setHours(0, 0, 0, 0);
        
        // Last day of previous month (Day 0 of current month = Last day of prev month)
        newEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        newEnd.setHours(23, 59, 59, 999);
        break;
      case 'last_6_months':
        // 1st day of month, 6 months ago
        newStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        newStart.setHours(0, 0, 0, 0);
        // End is today
        break;
    }
    onChange(newStart, newEnd);
    setIsOpen(false);
  };

  const handleManualApply = () => {
    // Parsing manual input securely
    const [startYear, startMonth, startDay] = tempStart.split('-').map(Number);
    const [endYear, endMonth, endDay] = tempEnd.split('-').map(Number);

    // Using constructor to avoid UTC/Local timezone shifts causing off-by-one errors
    const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
    const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
    
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      onChange(start, end);
      setIsOpen(false);
    }
  };

  const PresetButton = ({ label, onClick }: { label: string, onClick: () => void }) => (
    <button 
      onClick={onClick} 
      className="text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gold-600 dark:hover:text-gold-400 rounded-md transition-colors flex items-center"
    >
      <Clock className="w-3 h-3 mr-2 opacity-50" />
      {label}
    </button>
  );

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm focus:ring-2 focus:ring-gold-400 focus:outline-none"
      >
        <Calendar className="w-4 h-4 text-gold-500 dark:text-gold-400" />
        <span className="capitalize">{formatDate(startDate)} - {formatDate(endDate)}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden ring-1 ring-black ring-opacity-5 animate-fade-in-up">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="grid grid-cols-2 gap-1">
              <PresetButton label="Hoy" onClick={() => applyPreset('today')} />
              <PresetButton label="Ayer" onClick={() => applyPreset('yesterday')} />
              <PresetButton label="Últimos 7 días" onClick={() => applyPreset('week')} />
              <PresetButton label="Este Mes" onClick={() => applyPreset('month')} />
              <PresetButton label="Mes Pasado" onClick={() => applyPreset('last_month')} />
              <PresetButton label="Histórico (6M)" onClick={() => applyPreset('last_6_months')} />
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Desde</label>
              <input 
                type="date" 
                value={tempStart}
                onChange={(e) => setTempStart(e.target.value)}
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Hasta</label>
              <input 
                type="date" 
                value={tempEnd}
                min={tempStart}
                onChange={(e) => setTempEnd(e.target.value)}
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              />
            </div>
            <button 
              onClick={handleManualApply}
              className="w-full bg-gray-900 hover:bg-black dark:bg-gold-500 dark:hover:bg-gold-400 text-gold-400 dark:text-gray-900 font-bold py-2 px-4 rounded-lg text-sm flex items-center justify-center space-x-2 transition-colors shadow-lg"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar Rango</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;