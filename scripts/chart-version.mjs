export async function bumpChartVersions(db, patientIds) {
  const ids = [...new Set(patientIds.filter(Boolean))];
  if (ids.length === 0) return;
  await db.patient.updateMany({
    where: { id: { in: ids } },
    data: { chartVersion: { increment: 1 } },
  });
}
