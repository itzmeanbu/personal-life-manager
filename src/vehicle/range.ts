/**
 * Range math: remaining km = (sum litres in period × mileage) − (sum distance in period).
 * Mileage is always taken from the vehicle config — never a permanent 55 hard-code.
 */

import type { Vehicle, FuelRecord, DistanceRecord } from '../data/types';

export interface RangeSnapshot {
  totalLitres: number;
  totalFuelCost: number;
  estimatedRangeKm: number;
  distanceTravelledKm: number;
  remainingKm: number;
  lowWarning: boolean;
  critical: boolean; // remaining <= 0
}

export function inTrackingPeriod(date: string, vehicle: Vehicle): boolean {
  if (!vehicle.trackingStartedAt) return true;
  return date >= vehicle.trackingStartedAt;
}

export function computeRange(
  vehicle: Vehicle,
  fuel: FuelRecord[],
  distance: DistanceRecord[]
): RangeSnapshot {
  const mileage = vehicle.expectedMileageKmPerL > 0 ? vehicle.expectedMileageKmPerL : 0;

  const fuelInPeriod = fuel.filter(
    (f) => !f.deleted && f.vehicleId === vehicle.id && inTrackingPeriod(f.date, vehicle)
  );
  const distInPeriod = distance.filter(
    (d) => !d.deleted && d.vehicleId === vehicle.id && inTrackingPeriod(d.date, vehicle)
  );

  const totalLitres = fuelInPeriod.reduce((s, f) => s + (f.litres || 0), 0);
  const totalFuelCost = fuelInPeriod.reduce((s, f) => s + (f.cost || 0), 0);
  const estimatedRangeKm = totalLitres * mileage;
  const distanceTravelledKm = distInPeriod.reduce((s, d) => s + (d.km || 0), 0);
  const remainingKm = estimatedRangeKm - distanceTravelledKm;

  return {
    totalLitres,
    totalFuelCost,
    estimatedRangeKm,
    distanceTravelledKm,
    remainingKm,
    lowWarning: remainingKm > 0 && remainingKm <= vehicle.lowRangeWarnKm,
    critical: remainingKm <= 0 && totalLitres > 0,
  };
}

/** Money ÷ price = litres. */
export function litresFromMoney(money: number, pricePerLitre: number): number {
  if (pricePerLitre <= 0) return 0;
  return money / pricePerLitre;
}
