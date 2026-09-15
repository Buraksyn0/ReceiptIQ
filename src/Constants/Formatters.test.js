import { formatTR, formatShortTR } from './Formatters';

describe('formatTR', () => {
  test('binlik ayraç nokta, ondalık virgül kullanır', () => {
    expect(formatTR(427590.13)).toBe('427.590,13');
  });

  test('değer verilmezse 0,00 döner', () => {
    expect(formatTR()).toBe('0,00');
  });
});

describe('formatShortTR', () => {
  test('1000 üzeri değerleri K ile kısaltır', () => {
    expect(formatShortTR(1500)).toBe('1,5K');
  });

  test('1 milyon üzeri değerleri M ile kısaltır', () => {
    expect(formatShortTR(1500000)).toBe('1,5M');
  });

  test('1000 altı değerleri olduğu gibi (kuruşsuz) gösterir', () => {
    expect(formatShortTR(500)).toBe('500');
  });
});
