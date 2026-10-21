// US Census ACS 2024 5-year estimates (copied from the old reports page).
// Several values look rounded, so verify them against the Census before sharing a report outside the team.
export interface ZipDemo {
  med_income: number
  pct_poverty: number
  pct_hispanic: number
  pct_black: number
}

export const ZIP_DEMO: Record<string, ZipDemo> = {
  '60639': { med_income: 61089, pct_poverty: 13.4, pct_hispanic: 75.2, pct_black: 13.0 },
  '60651': { med_income: 54409, pct_poverty: 23.5, pct_hispanic: 44.5, pct_black: 49.8 },
  '60647': { med_income: 107060, pct_poverty: 8.4, pct_hispanic: 35.5, pct_black: 6.3 },
  '60623': { med_income: 51878, pct_poverty: 19.6, pct_hispanic: 65.3, pct_black: 28.6 },
  '60641': { med_income: 83758, pct_poverty: 10.4, pct_hispanic: 52.5, pct_black: 3.5 },
  '60629': { med_income: 60826, pct_poverty: 15.9, pct_hispanic: 75.4, pct_black: 16.5 },
  '60644': { med_income: 37952, pct_poverty: 25.9, pct_hispanic: 11.1, pct_black: 81.9 },
  '60632': { med_income: 64809, pct_poverty: 14.2, pct_hispanic: 81.0, pct_black: 5.0 },
  '60618': { med_income: 106384, pct_poverty: 6.9, pct_hispanic: 35.1, pct_black: 2.8 },
  '60622': { med_income: 136277, pct_poverty: 5.2, pct_hispanic: 18.0, pct_black: 3.0 },
  '60624': { med_income: 34030, pct_poverty: 28.4, pct_hispanic: 14.0, pct_black: 80.0 },
  '60636': { med_income: 36500, pct_poverty: 30.2, pct_hispanic: 28.0, pct_black: 65.0 },
  '60608': { med_income: 57000, pct_poverty: 17.8, pct_hispanic: 68.0, pct_black: 8.0 },
  '60634': { med_income: 88533, pct_poverty: 7.4, pct_hispanic: 40.0, pct_black: 3.0 },
  '60707': { med_income: 84799, pct_poverty: 8.0, pct_hispanic: 48.0, pct_black: 5.0 },
  '60804': { med_income: 58000, pct_poverty: 16.0, pct_hispanic: 78.0, pct_black: 5.0 },
  '60630': { med_income: 98860, pct_poverty: 4.6, pct_hispanic: 29.0, pct_black: 2.5 },
  '60617': { med_income: 55000, pct_poverty: 18.0, pct_hispanic: 35.0, pct_black: 48.0 },
  '60625': { med_income: 82000, pct_poverty: 9.0, pct_hispanic: 38.0, pct_black: 4.0 },
  '60620': { med_income: 48000, pct_poverty: 22.0, pct_hispanic: 8.0, pct_black: 84.0 },
  '60645': { med_income: 72000, pct_poverty: 10.0, pct_hispanic: 10.0, pct_black: 35.0 },
}

export type Tier = 'high' | 'med' | 'low' | 'none'

export function needTier(d?: ZipDemo): Tier {
  if (!d) return 'none'
  if (d.med_income < 50000 || d.pct_poverty > 20) return 'high'
  if (d.med_income < 75000 || d.pct_poverty > 12) return 'med'
  return 'low'
}

export const TIER_LABEL: Record<Tier, string> = { high: '🔴 High', med: '🟡 Med', low: '🟢 Low', none: '—' }