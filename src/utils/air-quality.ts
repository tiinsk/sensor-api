// This calculation function is copied from: https://docs.ruuvi.com/ruuvi-air-firmware/ruuvi-indoor-air-quality-score-iaqs

const AQI_MAX = 100;

const PM25_MAX = 60;
const PM25_MIN = 0;
const PM25_SCALE = AQI_MAX / (PM25_MAX - PM25_MIN); // ≈ 1.6667

const CO2_MAX = 2300;
const CO2_MIN = 420;
const CO2_SCALE = AQI_MAX / (CO2_MAX - CO2_MIN); // ≈ 0.05319

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

export function airQualityFromPm25Co2(
  pm25: number | undefined,
  co2: number | undefined
): number | undefined {
  if (pm25 === undefined || co2 === undefined) return undefined;

  const pm25Clamped = clamp(pm25, PM25_MIN, PM25_MAX);
  const co2Clamped = clamp(co2, CO2_MIN, CO2_MAX);

  const dx = (pm25Clamped - PM25_MIN) * PM25_SCALE; // 0..100
  const dy = (co2Clamped - CO2_MIN) * CO2_SCALE; // 0..100

  const r = Math.hypot(dx, dy);
  const clamped = clamp(AQI_MAX - r, 0, AQI_MAX);
  const quality = Math.round(clamped * 100) / 100; // round to 2 decimals


  return Number.isNaN(quality) ? undefined : quality;
}
