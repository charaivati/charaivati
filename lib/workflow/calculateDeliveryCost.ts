type CostFields = {
  costPerOrder?: number | null;
  costPerKg?: number | null;
  costPerKgPerKm?: number | null;
  costPerItemPerKm?: number | null;
};

export function calculateDeliveryCost({
  collaboration,
  totalWeightKg,
  totalItems,
  distanceKm,
}: {
  collaboration: CostFields;
  totalWeightKg: number;
  totalItems: number;
  distanceKm: number;
}): number {
  let cost = 0;
  if (collaboration.costPerOrder) cost += collaboration.costPerOrder;
  if (collaboration.costPerKg) cost += collaboration.costPerKg * totalWeightKg;
  if (collaboration.costPerKgPerKm) cost += collaboration.costPerKgPerKm * totalWeightKg * distanceKm;
  if (collaboration.costPerItemPerKm) cost += collaboration.costPerItemPerKm * totalItems * distanceKm;
  return Math.round(cost * 100) / 100;
}
