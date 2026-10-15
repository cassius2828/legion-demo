export async function applyRoseVisitNotes(db) {
  const notes = {
  vis_pat_16_01: {
    chiefComplaint: "Performance anxiety, rumination, and short sleep before evaluations.",
    clinicalSummary:
      "Intake. Derrick describes worry that starts two days before a show, then a night of three or four hours of sleep. He replays mistakes afterward and gets a racing heart on stage. Pre-event anxiety is 8 out of 10. No suicidal ideation. No psychiatric hospitalizations. Plan: start hydroxyzine 25 mg at bedtime only on those nights, and return to decide on a daily medicine.",
    followUp: "Return in two weeks. Call sooner if sleep drops below three hours or the worry spreads into ordinary days.",
    note: "New patient evaluation. Performance anxiety with rumination and short sleep before evaluations. Pre-event anxiety 8/10. Hydroxyzine 25 mg at bedtime as needed was started for those nights. Safety reviewed; no suicidal ideation.",
  },
  vis_pat_16_02: {
    chiefComplaint: "A recent show, with worry starting two days out and almost no sleep the night before.",
    clinicalSummary:
      "Psychotherapy. He played one set. The worry still started two days ahead, and he slept about four hours. Hydroxyzine took the edge off but he was groggy at rehearsal the next morning. Pre-event anxiety is 7 out of 10. Started escitalopram 10 mg every morning for the rumination between shows. Hydroxyzine continues for now.",
    followUp: "Return in three weeks. Skip hydroxyzine if he has a morning rehearsal.",
    note: "Psychotherapy focused on the two-day wind-up before a show. Pre-event anxiety 7/10. Escitalopram 10 mg every morning was started. Hydroxyzine helped sleep but caused morning grogginess.",
  },
  vis_pat_16_03: {
    chiefComplaint: "One event went better, but he still replays mistakes, and a sleep medicine left him foggy.",
    clinicalSummary:
      "Medication management. A smaller show went better: he stayed on stage for the whole set. He still replayed one missed cue for the rest of the night. Pre-event anxiety is 5 out of 10. Zolpidem 5 mg, tried twice, caused fog the next morning and is stopped. Propranolol 10 mg was added, to take about an hour before he goes on, not every day. Escitalopram continues. Hydroxyzine will stop if the grogginess happens again.",
    followUp: "Use propranolol an hour before the next performance. Return in two to three weeks.",
    note: "Medication visit. Pre-event anxiety 5/10 after a better set, with leftover rumination. Zolpidem stopped for next-day fog. Propranolol 10 mg as needed was added. Escitalopram continued.",
  },
  vis_pat_16_04: {
    chiefComplaint: "A higher-stakes week, with anxiety up again before a longer set.",
    clinicalSummary:
      "Psychotherapy during a week with two shows. Pre-event anxiety rose to 6 out of 10. He used propranolol once and the tremor was milder, but he still could not start the first song without rushing. Hydroxyzine was stopped today because rehearsal grogginess kept happening. Practiced a five-minute wind-down and saying the first verse out loud before leaving home. Escitalopram continued. Zolpidem stays stopped.",
    followUp: "Return after this run of shows. Propranolol an hour before, not the morning of.",
    note: "Psychotherapy for a higher-stakes week. Pre-event anxiety 6/10. Hydroxyzine discontinued for morning grogginess. Rehearsed the opening five minutes. Propranolol and escitalopram continued.",
  },
  vis_pat_16_05: {
    chiefComplaint: "Faster recovery after a show, and short sleep the night before is still the weak point.",
    clinicalSummary:
      "Psychotherapy. He came down from the last show in about an hour instead of a whole night of replaying it. Pre-event anxiety is 4 out of 10. Sleep the night before was still about four hours, now without hydroxyzine. Started trazodone 50 mg only on the night before a performance. Escitalopram and as-needed propranolol continue. No suicidal ideation on review today.",
    followUp: "Take trazodone 50 mg the night before the next evaluation, and skip it on ordinary nights. Return in three weeks.",
    note: "Psychotherapy. Recovery after the show was shorter. Pre-event anxiety 4/10. Trazodone 50 mg was started for the night before a performance only.",
  },
  vis_pat_16_06: {
    chiefComplaint: "Check of medicines ahead of the next scheduled evaluation.",
    clinicalSummary:
      "Medication management before an April evaluation. He used propranolol an hour ahead and did not feel foggy on stage. Trazodone the night before gave him about six hours of sleep, without the hangover hydroxyzine caused. Escitalopram is tolerated, with mild nausea in the first week that has passed. Pre-event anxiety is 3 out of 10 on an ordinary day and was 4 the morning of the last show. No dose changes.",
    followUp: "Keep the same doses. Return in four weeks, sooner if a performance week goes badly.",
    note: "Medication check. Propranolol, trazodone, and escitalopram all tolerated. Pre-event anxiety 3/10 between shows. No dose change.",
  },
  vis_pat_16_07: {
    chiefComplaint: "He kept the wind-down, but anxiety still spikes the morning of a show.",
    clinicalSummary:
      "Psychotherapy. He wrote the wind-down on a card and used it. The spike is now the morning of the show rather than two days before. Pre-event anxiety is 4 out of 10 that morning and closer to 3 once he is home. He did not replay the set past the first hour. Medicines unchanged: escitalopram daily, propranolol and trazodone only around performances.",
    followUp: "Practice the first five minutes out loud twice before the next show. Return in three weeks.",
    note: "Psychotherapy. The worry has moved from two days out to the morning of the show. Pre-event anxiety 4/10 that morning. No medication change.",
  },
  vis_pat_16_08: {
    chiefComplaint: "Side-effect check, and a question about taking propranolol on weeks with no show.",
    clinicalSummary:
      "Medication management. No dizziness, no new nausea, and no morning fog on trazodone when he takes it only the night before. He asked about using propranolol on quiet weeks. Advised not to: it is for the hour before he performs. Pre-event anxiety is 3 out of 10. Escitalopram stays at 10 mg.",
    followUp: "Propranolol stays as needed. Return in about a month.",
    note: "Medication visit. No side effects that need a change. Pre-event anxiety 3/10. Propranolol limited to the hour before a performance.",
  },
  vis_pat_16_09: {
    chiefComplaint: "He used the opening rehearsal, and the rumination after the show was shorter.",
    clinicalSummary:
      "Psychotherapy. He said the first verse out loud in the kitchen before leaving, and the start of the set was less rushed. Afterward he replayed one transition for about twenty minutes, then stopped. Pre-event anxiety is 3 out of 10. Sleep with trazodone was six hours. No medicine changes.",
    followUp: "Keep the written wind-down where he will see it. Return in three to four weeks.",
    note: "Psychotherapy. Opening rehearsal was used and the post-show replay was shorter. Pre-event anxiety 3/10. Medicines unchanged.",
  },
  vis_pat_16_10: {
    chiefComplaint: "Routine medicine visit, with no shows that went badly.",
    clinicalSummary:
      "Medication management. No emergency visits and no missed doses of escitalopram. He used propranolol for one club date and trazodone the night before. Heart racing was milder. Pre-event anxiety is 3 out of 10. He is not interested in a higher antidepressant dose. Plan left as it is.",
    followUp: "Same regimen. Return in four weeks unless sleep falls under five hours again.",
    note: "Medication visit. Adherence is steady and propranolol helped one club date. Pre-event anxiety 3/10. No dose change.",
  },
  vis_pat_16_11: {
    chiefComplaint: "A quiet month, with one small showcase and better sleep the night before.",
    clinicalSummary:
      "Psychotherapy. Only one small showcase. He slept about six hours the night before, compared with three or four hours at intake. Daytime worry between shows is mild. Pre-event anxiety that morning was 3 out of 10. He still wants a plan for a longer set later in the summer. Medicines unchanged.",
    followUp: "Return in four weeks. Use the same night-before and hour-before plan for the longer set.",
    note: "Psychotherapy after a quieter month. Sleep before the showcase was about six hours. Pre-event anxiety 3/10. No medication change.",
  },
  vis_pat_16_12: {
    chiefComplaint: "A busier festival week raised symptoms for two days, then they settled.",
    clinicalSummary:
      "Medication management after a festival week with three sets. Pre-event anxiety reached 5 out of 10 for two of those days, then returned to 3. He used trazodone each night before a set and propranolol an hour ahead. He felt wired after the late set but did not add any other medicine. Escitalopram continued. No suicidal ideation when asked, given the busier week.",
    followUp: "No new medicine for busy weeks. Return in four weeks.",
    note: "Medication visit after a festival week. Anxiety rose to 5/10 for two days, then settled. Propranolol and trazodone were used as planned. No new prescription.",
  },
  vis_pat_16_13: {
    chiefComplaint: "Nursing check of how he times propranolol and trazodone.",
    clinicalSummary:
      "Nursing check-in with Jordan Hale, PMHNP. He takes escitalopram every morning. Propranolol is only about an hour before he performs, and trazodone is only the night before. No dizziness on standing, no rash, and no morning grogginess like the hydroxyzine period. Blood pressure in clinic was in his usual range. No dose change. He knows to call if he feels lightheaded on stage.",
    followUp: "Clinician visit next month. Call sooner for dizziness on standing or a fainting feeling.",
    note: "Nursing check-in. Propranolol and trazodone timing reviewed. No orthostatic symptoms and no grogginess. Escitalopram adherence confirmed.",
  },
  vis_pat_16_14: {
    chiefComplaint: "Planning the October evaluation without treating it like a relapse.",
    clinicalSummary:
      "Psychotherapy. An evaluation is booked for October. He wants to keep the usual afternoon appointment that week. Pre-event anxiety today is 4 out of 10, which is the planning spike, not the 8 from intake. Sleep on ordinary nights is adequate. The plan for that week is trazodone the night before and propranolol an hour before, plus the five-minute opening rehearsal. Escitalopram stays at 10 mg. Hydroxyzine and zolpidem stay stopped.",
    followUp: "Keep the October week on this usual afternoon. Call if sleep the week of the evaluation falls apart.",
    note: "Psychotherapy aimed at the October evaluation. Pre-event anxiety 4/10 today. Trazodone, propranolol, and the opening rehearsal were planned. No medication restart.",
  },
};

  for (const [visitId, entry] of Object.entries(notes)) {
  await db.visit.update({
    where: { id: visitId },
    data: {
      chiefComplaint: entry.chiefComplaint,
      clinicalSummary: entry.clinicalSummary,
      followUpInstructions: entry.followUp,
    },
  });
  await db.clinicalNote.updateMany({
    where: { visitId },
    data: { content: entry.note },
  });
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: { appointmentId: true },
  });
  if (visit) {
    await db.appointment.update({
      where: { id: visit.appointmentId },
      data: {
        reasonForVisit: entry.chiefComplaint,
        description: entry.clinicalSummary,
      },
    });
  }
}
  return Object.keys(notes).length;
}

const isDirect = process.argv[1]?.endsWith("vary-rose-notes.mjs");
if (isDirect) {
  const { PrismaClient } = await import("../generated/prisma/index.js");
  const db = new PrismaClient();
  const count = await applyRoseVisitNotes(db);
  console.log(`Updated ${count} visits`);
  await db.$disconnect();
}
