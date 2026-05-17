import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useContext as useReactContext } from 'react';
import { AuthContext } from './AuthContext';

const MONTH_NAMES = {
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  fr: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
  ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
};

export const DATE_FORMATS = [
  { key: 'DD/MM/YYYY', label: 'GG/AA/YYYY', example: '15/05/2026' },
  { key: 'MM/DD/YYYY', label: 'MM/GG/YYYY', example: '05/15/2026' },
  { key: 'YYYY-MM-DD', label: 'YYYY-AA-GG', example: '2026-05-15' },
  { key: 'DD.MM.YYYY', label: 'GG.AA.YYYY', example: '15.05.2026' },
  { key: 'DD MMM YYYY', label: 'GG AAA YYYY', example: '15 May 2026' },
];

const DateFormatContext = createContext({
  dateFormat: 'DD/MM/YYYY',
  setDateFormat: () => {},
  formatDate: (dateStr) => dateStr,
});

export function DateFormatProvider({ children, language = 'tr' }) {
  const { user } = useReactContext(AuthContext);
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');

  useEffect(() => {
    if (user?.date_format_preference) {
      setDateFormat(user.date_format_preference);
    }
  }, [user?.date_format_preference]);

  const formatDate = useCallback((dateStr, lang) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;

      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = String(d.getFullYear());
      const monthNames = MONTH_NAMES[lang || language] || MONTH_NAMES.en;
      const mmm = monthNames[d.getMonth()];

      switch (dateFormat) {
        case 'DD/MM/YYYY':  return `${dd}/${mm}/${yyyy}`;
        case 'MM/DD/YYYY':  return `${mm}/${dd}/${yyyy}`;
        case 'YYYY-MM-DD':  return `${yyyy}-${mm}-${dd}`;
        case 'DD.MM.YYYY':  return `${dd}.${mm}.${yyyy}`;
        case 'DD MMM YYYY': return `${dd} ${mmm} ${yyyy}`;
        default:            return `${dd}/${mm}/${yyyy}`;
      }
    } catch {
      return dateStr;
    }
  }, [dateFormat, language]);

  return (
    <DateFormatContext.Provider value={{ dateFormat, setDateFormat, formatDate }}>
      {children}
    </DateFormatContext.Provider>
  );
}

export function useDateFormat() {
  return useContext(DateFormatContext);
}
