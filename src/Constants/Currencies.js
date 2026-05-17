export const CURRENCIES = [
  { code: 'TRY', symbol: '₺', name: { tr: 'Türk Lirası',    en: 'Turkish Lira',    de: 'Türkische Lira',    fr: 'Livre turque',      ru: 'Турецкая лира'   }, flag: '🇹🇷' },
  { code: 'USD', symbol: '$', name: { tr: 'Amerikan Doları', en: 'US Dollar',       de: 'US-Dollar',         fr: 'Dollar américain',  ru: 'Доллар США'      }, flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: { tr: 'Euro',            en: 'Euro',            de: 'Euro',              fr: 'Euro',              ru: 'Евро'            }, flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: { tr: 'İngiliz Sterlini',en: 'British Pound',   de: 'Britisches Pfund',  fr: 'Livre sterling',    ru: 'Фунт стерлингов' }, flag: '🇬🇧' },
  { code: 'RUB', symbol: '₽', name: { tr: 'Rus Rublesi',     en: 'Russian Ruble',   de: 'Russischer Rubel',  fr: 'Rouble russe',      ru: 'Российский рубль'}, flag: '🇷🇺' },
  { code: 'JPY', symbol: '¥', name: { tr: 'Japon Yeni',      en: 'Japanese Yen',    de: 'Japanischer Yen',   fr: 'Yen japonais',      ru: 'Японская иена'   }, flag: '🇯🇵' },
  { code: 'CNY', symbol: '¥', name: { tr: 'Çin Yuanı',       en: 'Chinese Yuan',    de: 'Chinesischer Yuan', fr: 'Yuan chinois',      ru: 'Китайский юань'  }, flag: '🇨🇳' },
  { code: 'CHF', symbol: 'Fr',name: { tr: 'İsviçre Frangı',  en: 'Swiss Franc',     de: 'Schweizer Franken', fr: 'Franc suisse',      ru: 'Швейцарский франк'}, flag: '🇨🇭' },
  { code: 'CAD', symbol: 'C$',name: { tr: 'Kanada Doları',   en: 'Canadian Dollar', de: 'Kanadischer Dollar',fr: 'Dollar canadien',   ru: 'Канадский доллар'}, flag: '🇨🇦' },
  { code: 'AUD', symbol: 'A$',name: { tr: 'Avustralya Doları',en:'Australian Dollar',de: 'Australischer Dollar',fr:'Dollar australien', ru: 'Австралийский доллар'}, flag: '🇦🇺' },
  { code: 'AED', symbol: 'د.إ',name:{ tr: 'BAE Dirhemi',     en: 'UAE Dirham',      de: 'VAE-Dirham',        fr: 'Dirham des EAU',    ru: 'Дирхам ОАЭ'      }, flag: '🇦🇪' },
  { code: 'SAR', symbol: '﷼', name: { tr: 'Suudi Riyali',    en: 'Saudi Riyal',     de: 'Saudi-Riyal',       fr: 'Riyal saoudien',    ru: 'Саудовский риял' }, flag: '🇸🇦' },
  { code: 'INR', symbol: '₹', name: { tr: 'Hint Rupisi',     en: 'Indian Rupee',    de: 'Indische Rupie',    fr: 'Roupie indienne',   ru: 'Индийская рупия' }, flag: '🇮🇳' },
  { code: 'BRL', symbol: 'R$',name: { tr: 'Brezilya Reali',  en: 'Brazilian Real',  de: 'Brasilianischer Real',fr:'Réal brésilien',   ru: 'Бразильский реал'}, flag: '🇧🇷' },
  { code: 'MXN', symbol: '$', name: { tr: 'Meksika Pesosu',  en: 'Mexican Peso',    de: 'Mexikanischer Peso',fr: 'Peso mexicain',     ru: 'Мексиканское песо'}, flag: '🇲🇽' },
];

export function getCurrencySymbol(code) {
  const found = CURRENCIES.find(c => c.code === code);
  return found ? found.symbol : code;
}

export function getCurrencyName(code, lang = 'en') {
  const found = CURRENCIES.find(c => c.code === code);
  if (!found) return code;
  return found.name[lang] || found.name.en;
}
