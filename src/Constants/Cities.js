// Türkiye'nin 81 ili + dünya şehirleri
export const CITIES = [
  // Türkiye
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara',
  'Antalya', 'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman',
  'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa',
  'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne',
  'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun',
  'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir',
  'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri',
  'Kilis', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya',
  'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde',
  'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas',
  'Şanlıurfa', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak',
  'Van', 'Yalova', 'Yozgat', 'Zonguldak',
  // Avrupa
  'Amsterdam', 'Atina', 'Barselona', 'Berlin', 'Brüksel', 'Budapeşte', 'Dublin',
  'Frankfurt', 'Hamburg', 'Helsinki', 'Kopenhag', 'Lizbon', 'Londra', 'Madrid',
  'Marsilya', 'Milano', 'Münih', 'Oslo', 'Paris', 'Prag', 'Roma', 'Rotterdam',
  'Stockholm', 'Varşova', 'Viyana', 'Zürih',
  // Amerika
  'Chicago', 'Houston', 'Los Angeles', 'Mexico City', 'Miami', 'Montreal',
  'New York', 'San Francisco', 'São Paulo', 'Toronto', 'Vancouver', 'Washington DC',
  // Asya & Orta Doğu
  'Bağdat', 'Bakü', 'Bangkok', 'Beyrut', 'Dubai', 'Hong Kong', 'Jakarta',
  'Kahire', 'Karachi', 'Kuala Lumpur', 'Münih', 'Mumbai', 'Pekin', 'Riyad',
  'Seul', 'Şanghay', 'Singapur', 'Tahran', 'Tel Aviv', 'Tokyo', 'Yeni Delhi',
  // Afrika & Okyanusya
  'Johannesburg', 'Lagos', 'Melbourne', 'Nairobi', 'Sydney',
  // Rusya & Yakın Çevre
  'Almatı', 'Bişkek', 'Moskova', 'Sankt Petersburg', 'Taşkent', 'Tiflis',
];

export function filterCities(query) {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim().toLowerCase();
  return CITIES.filter(city =>
    city.toLowerCase().startsWith(q) ||
    city.toLowerCase().includes(q)
  ).slice(0, 6);
}
