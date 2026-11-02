/**
 * Liste complète des pays du monde (ISO 3166-1) avec leur devise locale.
 * Sert au choix du pays à l'inscription : la devise de l'établissement et les
 * prix des abonnements s'adaptent automatiquement au pays sélectionné.
 */

export interface Country {
  code: string;
  name: string;
  currency: string;
  dial: string;
}

const RAW = `
AF|AFN|93
AL|ALL|355
DZ|DZD|213
AD|EUR|376
AO|AOA|244
AG|XCD|1268
AR|ARS|54
AM|AMD|374
AU|AUD|61
AT|EUR|43
AZ|AZN|994
BS|BSD|1242
BH|BHD|973
BD|BDT|880
BB|BBD|1246
BY|BYN|375
BE|EUR|32
BZ|BZD|501
BJ|XOF|229
BT|BTN|975
BO|BOB|591
BA|BAM|387
BW|BWP|267
BR|BRL|55
BN|BND|673
BG|BGN|359
BF|XOF|226
BI|BIF|257
CV|CVE|238
KH|KHR|855
CM|XAF|237
CA|CAD|1
CF|XAF|236
TD|XAF|235
CL|CLP|56
CN|CNY|86
CO|COP|57
KM|KMF|269
CG|XAF|242
CD|CDF|243
CR|CRC|506
CI|XOF|225
HR|EUR|385
CU|CUP|53
CY|EUR|357
CZ|CZK|420
DK|DKK|45
DJ|DJF|253
DM|XCD|1767
DO|DOP|1809
EC|USD|593
EG|EGP|20
SV|USD|503
GQ|XAF|240
ER|ERN|291
EE|EUR|372
SZ|SZL|268
ET|ETB|251
FJ|FJD|679
FI|EUR|358
FR|EUR|33
GA|XAF|241
GM|GMD|220
GE|GEL|995
DE|EUR|49
GH|GHS|233
GR|EUR|30
GD|XCD|1473
GT|GTQ|502
GN|GNF|224
GW|XOF|245
GY|GYD|592
HT|HTG|509
HN|HNL|504
HU|HUF|36
IS|ISK|354
IN|INR|91
ID|IDR|62
IR|IRR|98
IQ|IQD|964
IE|EUR|353
IL|ILS|972
IT|EUR|39
JM|JMD|1876
JP|JPY|81
JO|JOD|962
KZ|KZT|7
KE|KES|254
KI|AUD|686
KW|KWD|965
KG|KGS|996
LA|LAK|856
LV|EUR|371
LB|LBP|961
LS|LSL|266
LR|LRD|231
LY|LYD|218
LI|CHF|423
LT|EUR|370
LU|EUR|352
MG|MGA|261
MW|MWK|265
MY|MYR|60
MV|MVR|960
ML|XOF|223
MT|EUR|356
MH|USD|692
MR|MRU|222
MU|MUR|230
MX|MXN|52
FM|USD|691
MD|MDL|373
MC|EUR|377
MN|MNT|976
ME|EUR|382
MA|MAD|212
MZ|MZN|258
MM|MMK|95
NA|NAD|264
NR|AUD|674
NP|NPR|977
NL|EUR|31
NZ|NZD|64
NI|NIO|505
NE|XOF|227
NG|NGN|234
KP|KPW|850
MK|MKD|389
NO|NOK|47
OM|OMR|968
PK|PKR|92
PW|USD|680
PA|PAB|507
PG|PGK|675
PY|PYG|595
PE|PEN|51
PH|PHP|63
PL|PLN|48
PT|EUR|351
QA|QAR|974
RO|RON|40
RU|RUB|7
RW|RWF|250
KN|XCD|1869
LC|XCD|1758
VC|XCD|1784
WS|WST|685
SM|EUR|378
ST|STN|239
SA|SAR|966
SN|XOF|221
RS|RSD|381
SC|SCR|248
SL|SLE|232
SG|SGD|65
SK|EUR|421
SI|EUR|386
SB|SBD|677
SO|SOS|252
ZA|ZAR|27
KR|KRW|82
SS|SSP|211
ES|EUR|34
LK|LKR|94
SD|SDG|249
SR|SRD|597
SE|SEK|46
CH|CHF|41
SY|SYP|963
TW|TWD|886
TJ|TJS|992
TZ|TZS|255
TH|THB|66
TL|USD|670
TG|XOF|228
TO|TOP|676
TT|TTD|1868
TN|TND|216
TR|TRY|90
TM|TMT|993
TV|AUD|688
UG|UGX|256
UA|UAH|380
AE|AED|971
GB|GBP|44
US|USD|1
UY|UYU|598
UZ|UZS|998
VU|VUV|678
VA|EUR|379
VE|VES|58
VN|VND|84
YE|YER|967
ZM|ZMW|260
ZW|ZWL|263
HK|HKD|852
MO|MOP|853
PR|USD|1787
GL|DKK|299
NC|XPF|687
PF|XPF|689
RE|EUR|262
GP|EUR|590
MQ|EUR|596
GF|EUR|594
YT|EUR|269
`.trim();

function regionName(code: string, fallback: string) {
  try {
    const names = new Intl.DisplayNames(['fr'], { type: 'region' });
    return names.of(code) ?? fallback;
  } catch {
    return fallback;
  }
}

export const COUNTRIES: Country[] = RAW.split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [code, currency, dial] = line.split('|');
    return { code, currency, dial: `+${dial}`, name: regionName(code, code) };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

export const DEFAULT_COUNTRY = 'CG';

export function countryByCode(code?: string | null): Country {
  return BY_CODE.get(String(code ?? '').toUpperCase()) ?? COUNTRIES.find((c) => c.code === DEFAULT_COUNTRY)!;
}

export const CURRENCY_NAMES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  try {
    const names = new Intl.DisplayNames(['fr'], { type: 'currency' });
    COUNTRIES.forEach((country) => {
      if (!out[country.currency]) out[country.currency] = names.of(country.currency) ?? country.currency;
    });
  } catch { /* noms de devises facultatifs */ }
  return out;
})();

/** Devises utilisables (une entrée par devise, avec les pays concernés). */
export const CURRENCIES = Array.from(new Set(COUNTRIES.map((country) => country.currency))).sort();

const NO_DECIMALS = new Set(['XAF', 'XOF', 'XPF', 'CDF', 'GNF', 'KMF', 'RWF', 'BIF', 'DJF', 'CLP', 'PYG',
  'VND', 'IDR', 'KRW', 'JPY', 'UGX', 'TZS', 'NGN', 'MGA', 'XCD', 'CRC', 'ISK', 'HUF']);

export function formatCurrency(value: number | null | undefined, currency = 'XAF'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const fractionDigits = NO_DECIMALS.has(currency) ? 0 : value >= 1000 ? 0 : 2;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat('fr-FR').format(value)} ${currency}`;
  }
}

/** Conversion indicative depuis les taux renvoyés par l'API (base FCFA). */
export function convertFromFcfa(amount: number, currency: string, rates?: Record<string, number> | null): number {
  const rate = rates?.[currency] ?? (currency === 'XAF' ? 1 : null);
  if (!rate) return amount;
  const value = amount * rate;
  if (rate >= 100) return Math.round(value / 100) * 100;
  if (rate >= 1) return Math.round(value);
  return Math.round(value * 100) / 100;
}
