export const PHARMACIES = [
  {
    id: "pharm_01",
    name: "H-E-B Pharmacy",
    street: "2701 E 7th St",
    city: "Austin",
    state: "TX",
    phone: "512-478-7322",
    ncpdpId: "5901123",
  },
  {
    id: "pharm_02",
    name: "CVS Pharmacy",
    street: "1111 Congress Ave",
    city: "Austin",
    state: "TX",
    phone: "512-476-1200",
    ncpdpId: "5901456",
  },
  {
    id: "pharm_03",
    name: "Walgreens",
    street: "400 W 15th St",
    city: "Austin",
    state: "TX",
    phone: "512-476-5491",
    ncpdpId: "5901789",
  },
  {
    id: "pharm_04",
    name: "Randalls Pharmacy",
    street: "2025 Guadalupe St",
    city: "Austin",
    state: "TX",
    phone: "512-474-1400",
    ncpdpId: "5902012",
  },
];

export async function seedPharmacies(db) {
  for (const pharmacy of PHARMACIES) {
    const { id, ...data } = pharmacy;
    await db.pharmacy.upsert({
      where: { id },
      update: data,
      create: pharmacy,
    });
  }
  return PHARMACIES.length;
}
