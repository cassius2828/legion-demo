const CLINIC_TODAY = new Date(2026, 9, 15, 12, 0, 0, 0);
const NURSE_ID = "prv_02";
const HOURS = [8, 9, 9, 10, 11, 13, 14, 15, 16];

const COURSE_BY_PATIENT = {
  pat_01: "depression",
  pat_02: "anxiety",
  pat_03: "bipolar",
  pat_04: "anxiety-stopped",
  pat_05: "depression",
  pat_06: "panic",
  pat_07: "ptsd",
  pat_08: "adhd",
  pat_09: "bipolar",
  pat_10: "anxiety",
  pat_11: "intake",
  pat_12: "remission",
  pat_13: "psychosis",
  pat_14: "anxiety",
  pat_15: "depression",
  pat_16: "performance",
  pat_17: "depression",
  pat_18: "ptsd",
  pat_19: "anxiety",
  pat_20: "bipolar",
  pat_21: "panic",
  pat_22: "adhd",
  pat_23: "depression",
  pat_24: "anxiety",
  pat_25: "psychosis",
  pat_26: "depression",
  pat_27: "remission",
  pat_28: "anxiety",
  pat_29: "performance",
  pat_30: "anxiety",
  pat_31: "bipolar",
  pat_32: "ptsd",
  pat_33: "depression",
  pat_34: "adhd",
  pat_35: "panic",
  pat_36: "psychosis",
};

const COURSES = {
  depression: {
    scoreName: "PHQ-9",
    scores: [18, 16, 14, 11, 13, 9, 7, 6, 7],
    focuses: [
      "Establish the depression course, ask about safety, and agree on a first plan.",
      "Check early side effects and whether sleep has started to change.",
      "Decide if the current dose is enough after the first month.",
      "Add a concrete daytime routine once mood is partly better.",
      "Respond to a seasonal dip without stacking a second medicine.",
      "Review work attendance, energy, and interest in usual activities.",
      "Stretch the interval now that scores are in a milder range.",
      "Confirm the same plan still fits before the next season.",
    ],
  },
  anxiety: {
    scoreName: "GAD-7",
    scores: [16, 14, 12, 10, 11, 8, 6, 5],
    focuses: [
      "Map the worry, muscle tension, and sleep pattern from the last month.",
      "Review the first weeks of treatment, including jitteriness and nausea.",
      "Practice one exposure or worry-delay step and see what got in the way.",
      "Look at a stressful week and whether symptoms returned to baseline.",
      "Tighten the sleep window and cut late caffeine if it is still in the picture.",
      "Note fewer physical symptoms and more follow-through at work or school.",
      "Move toward a maintenance interval with a written relapse plan.",
    ],
  },
  "anxiety-stopped": {
    scoreName: "GAD-7",
    scores: [11, 9, 8, 10, 7, 6],
    focuses: [
      "Review why medication was stopped and what symptoms remain.",
      "Use therapy targets only, and watch for a rebound of physical anxiety.",
      "Check sleep and avoidance after a month off medication.",
      "A presentation week raised symptoms. Hold the no-medication plan if safety is intact.",
      "Symptoms are back near the better range. Keep therapy homework.",
      "Maintenance visit without restarting medication.",
    ],
  },
  panic: {
    scoreName: "panic attacks this month",
    scores: [8, 6, 4, 5, 3, 2, 1, 1],
    focuses: [
      "Clarify triggers, feared sensations, and where the patient will not go.",
      "Early treatment. Attacks are still frequent, but the patient can name the sensations.",
      "Fewer attacks. Practice staying in one previously avoided place.",
      "A crowded commute caused a setback. Review the breathing plan.",
      "Attacks are shorter. Expand one avoided route.",
      "Most weeks have no full attack. Keep a rescue plan for travel.",
      "Maintenance. Ask about caffeine, sleep, and the next trip.",
    ],
  },
  bipolar: {
    scoreName: "mood check (0 even, higher is more elevated or irritable)",
    scores: [4, 3, 6, 2, 3, 1, 2, 1],
    focuses: [
      "Confirm the bipolar course, sleep hours, and any recent elevated week.",
      "Early follow-up for side effects and whether sleep is at least seven hours.",
      "A short run of later bedtimes. Reinforce the sleep window before mood shifts.",
      "Mood is more even. Review work function and medication adherence.",
      "Seasonal energy change without a full hypomanic episode.",
      "Stable interval. Family reports no spending sprees or lost nights of sleep.",
      "Maintenance visit. Keep the same regimen and the same bedtime.",
    ],
  },
  ptsd: {
    scoreName: "PCL-5",
    scores: [58, 54, 49, 46, 42, 38, 35, 33],
    focuses: [
      "Intake for trauma symptoms, nightmares, and current avoidance.",
      "Nightmares are still most nights. Start a regular wind-down and a return visit soon.",
      "Nightmare frequency is down. Irritability at home is the remaining concern.",
      "A reminder cue raised symptoms for two days, then they settled.",
      "The patient can describe the event with less flooding than at intake.",
      "Sleep is more continuous. Avoidance of one place has eased.",
      "Maintenance. Watch anniversary dates and keep the grounding steps.",
    ],
  },
  adhd: {
    scoreName: "missed deadlines this month",
    scores: [7, 5, 3, 2, 2],
    focuses: [
      "New evaluation for attention, losing instructions, and unfinished tasks.",
      "First medication check. Appetite and sleep are the side-effect questions.",
      "Focus at work or school is better in the morning than the afternoon.",
      "A dose-timing change. Evening crash is milder.",
      "Routine follow-up. Organization tools are actually being used.",
    ],
  },
  psychosis: {
    scoreName: "symptom check (0 quiet, higher is more intrusive)",
    scores: [6, 5, 4, 5, 3, 2, 2, 3],
    focuses: [
      "Review voices or paranoid thoughts, sleep, and whether doses are being taken.",
      "Symptoms are a bit quieter. Family confirms the medication is taken most days.",
      "A family argument raised stress. No return of dangerous behavior.",
      "Adherence slipped for several days and symptoms edged up. Restart the routine.",
      "Symptoms are back down. Review primary-care labs and daytime structure.",
      "Stable stretch. No emergency visits since the last appointment.",
      "Maintenance. Keep the same dose and the same early warning list.",
    ],
  },
  remission: {
    scoreName: "PHQ-9",
    scores: [8, 6, 5, 4, 5, 3, 4],
    focuses: [
      "Depression has improved. Discuss whether a taper is reasonable.",
      "Early taper. Watch sleep, interest, and tearfulness.",
      "Still improved after the dose decrease. No new safety concerns.",
      "Medication is stopped. Agree on warning signs that should prompt a call.",
      "A mildly lower week did not turn into a full relapse.",
      "Function is steady. Keep a longer follow-up interval.",
      "Monitoring visit. Restart only if the low mood lasts more than two weeks.",
    ],
  },
  performance: {
    scoreName: "pre-event anxiety (0 calm, 10 overwhelming)",
    scores: [8, 7, 5, 6, 4, 3, 4],
    focuses: [
      "Intake for performance anxiety, rumination, and short sleep before evaluations.",
      "Review a recent event. Sleep was short the night before, and the worry started two days out.",
      "One event went better. The patient still replays mistakes afterward.",
      "A higher-stakes week. Rehearse the wind-down and the first five minutes.",
      "Anxiety is lower and recovery after the event is faster.",
      "Maintenance before the next scheduled evaluation.",
      "Plan the next visit on the weekday and time this patient usually keeps.",
    ],
  },
  intake: {
    scoreName: "PHQ-9",
    scores: [14, 12],
    focuses: [
      "First visit. Low mood and poor concentration brought in from primary care.",
      "Early return. Confirm safety, sleep, and whether the first plan is tolerable.",
    ],
  },
};

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTod(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function appointmentTitle(patient, date) {
  return `${patient.firstName} ${patient.lastName}, ${formatTod(date)}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function place(from, weekday, hour, minute) {
  const date = new Date(from);
  date.setHours(hour, minute, 0, 0);
  let guard = 0;
  while (date.getDay() !== weekday && guard < 7) {
    date.setDate(date.getDate() + 1);
    guard += 1;
  }
  return date;
}

function maxPast(patient, course, rng) {
  if (course === "intake") return rng() < 0.45 ? 1 : 2;
  const start = new Date(patient.createdAt);
  const months = (CLINIC_TODAY.getFullYear() - start.getFullYear()) * 12 + (CLINIC_TODAY.getMonth() - start.getMonth());
  const cap = course === "adhd" ? 5 : course === "remission" ? 7 : 11;
  const floor = months < 2 ? 2 : months < 6 ? 4 : months < 14 ? 8 : 10;
  return Math.min(cap, floor + Math.floor(rng() * 3));
}

function gapDays(course, rng) {
  if (course === "psychosis" || course === "bipolar") return 21 + Math.floor(rng() * 28);
  if (course === "ptsd" || course === "panic" || course === "performance") return 7 + Math.floor(rng() * 21);
  if (course === "adhd" || course === "intake") return 14 + Math.floor(rng() * 21);
  if (course === "remission" || course === "anxiety-stopped") return 35 + Math.floor(rng() * 40);
  return 14 + Math.floor(rng() * 35);
}

function pickHour(preferred, rng) {
  if (rng() < 0.74) return preferred;
  return HOURS[Math.floor(rng() * HOURS.length)];
}

function pickWeekday(preferred, rng) {
  if (rng() < 0.7) return preferred;
  return ((preferred + Math.floor(rng() * 3)) % 5) + 1;
}

function pickMinute(rng) {
  const choices = [0, 0, 15, 30, 30];
  return choices[Math.floor(rng() * choices.length)];
}

function visitKind(course, index, providerId, rng) {
  if (index === 0) return { type: "New patient evaluation", minutes: 60, nurseId: null };
  const roll = rng();
  if (providerId !== NURSE_ID && roll < 0.14) {
    return { type: "Nursing check-in", minutes: 20, nurseId: NURSE_ID };
  }
  if ((course === "psychosis" || course === "ptsd") && roll > 0.9) {
    return { type: "Crisis follow-up", minutes: 30, nurseId: null };
  }
  const therapy = new Set(["ptsd", "anxiety", "anxiety-stopped", "panic", "performance"]);
  if (therapy.has(course) && roll < 0.58) {
    return { type: "Psychotherapy", minutes: 50, nurseId: null };
  }
  if (roll < 0.28) return { type: "Follow-up", minutes: 30, nurseId: null };
  return { type: "Medication management", minutes: 30, nurseId: null };
}

const MAINTENANCE = [
  "Sleep and daytime function are about the same as last time.",
  "A busier week raised symptoms for a few days, then they settled.",
  "Medication is being taken as prescribed, with no new side effects.",
  "The usual weekday and time still fits this patient's schedule.",
  "There have been no emergency visits since the last appointment.",
];

function stageAt(course, index) {
  const plan = COURSES[course];
  const last = plan.focuses.length - 1;
  const at = Math.min(index, last);
  return {
    focus: plan.focuses[at],
    scoreName: plan.scoreName,
    score: plan.scores[Math.min(index, plan.scores.length - 1)],
    extended: index > last,
  };
}

function historyLine(patient) {
  const sentence = patient.psychiatricHistory.split(".")[0];
  return sentence ?? patient.psychiatricHistory;
}

function buildSchedule(patient, course, rng) {
  const hash = hashString(patient.id);
  const preferredHour = HOURS[hash % HOURS.length];
  const preferredDay = (hash % 5) + 1;
  const limit = maxPast(patient, course, rng);
  let cursor = new Date(patient.createdAt);
  cursor.setHours(0, 0, 0, 0);
  const slots = [];

  while (slots.length < limit && cursor < CLINIC_TODAY) {
    const when = place(cursor, pickWeekday(preferredDay, rng), pickHour(preferredHour, rng), pickMinute(rng));
    if (when >= CLINIC_TODAY) break;
    if (when < new Date(patient.createdAt)) {
      cursor = addDays(cursor, 1);
      continue;
    }
    slots.push(when);
    cursor = addDays(when, gapDays(course, rng));
  }

  while (course !== "intake" && slots.length < 14 && slots.length > 0) {
    const last = slots[slots.length - 1];
    const daysBeforeToday = (CLINIC_TODAY.getTime() - last.getTime()) / 86400000;
    if (daysBeforeToday < 45) break;
    const when = place(
      addDays(last, gapDays(course, rng)),
      pickWeekday(preferredDay, rng),
      pickHour(preferredHour, rng),
      pickMinute(rng),
    );
    if (when >= CLINIC_TODAY || when.getTime() === last.getTime()) break;
    slots.push(when);
  }

  if (slots.length === 0) {
    const fallback = new Date(patient.createdAt);
    if (fallback < CLINIC_TODAY) {
      slots.push(place(fallback, preferredDay, preferredHour, 0));
    }
  }

  const latest = slots.length > 0 ? slots[slots.length - 1] : CLINIC_TODAY;
  let futureFrom = addDays(latest, 14);
  if (futureFrom < addDays(CLINIC_TODAY, 3)) {
    futureFrom = addDays(CLINIC_TODAY, 7 + Math.floor(rng() * 18));
  }
  const futureCount = rng() < 0.42 ? 2 : 1;
  for (let index = 0; index < futureCount; index += 1) {
    const when = place(futureFrom, pickWeekday(preferredDay, rng), pickHour(preferredHour, rng), pickMinute(rng));
    slots.push(when);
    futureFrom = addDays(when, 21 + Math.floor(rng() * 28));
  }

  return slots;
}

function recordsFor(patient) {
  const course = COURSE_BY_PATIENT[patient.id] ?? "depression";
  const rng = mulberry32(hashString(`${patient.id}:visits`));
  const slots = buildSchedule(patient, course, rng);
  const appointments = [];
  const visits = [];
  const notes = [];
  let missedPrevious = false;
  let stageIndex = 0;

  slots.forEach((when, index) => {
    const future = when >= CLINIC_TODAY;
    let status = future ? "scheduled" : "completed";
    if (!future && index > 0 && index < slots.length - 1 && rng() < 0.11) {
      status = rng() < 0.55 ? "no-show" : "cancelled";
    }
    const kind = visitKind(course, stageIndex, patient.primaryProviderId, rng);
    const stage = stageAt(course, stageIndex);
    const focusLine = stage.extended
      ? `Maintenance visit. ${MAINTENANCE[stageIndex % MAINTENANCE.length]}`
      : stage.focus;
    if (status === "completed" || status === "scheduled") stageIndex += 1;
    const id = `apt_${patient.id}_${pad(index + 1)}`;
    const name = `${patient.firstName} ${patient.lastName}`;
    let description = `${kind.type} for ${name}. ${focusLine}`;
    if (status === "no-show") {
      description = `${kind.type} for ${name} was scheduled for ${formatTod(when)}. ${name} did not arrive, so there is no visit note.`;
    }
    if (status === "cancelled") {
      description = `${kind.type} for ${name} was cancelled before the visit. The plan from the previous note stays in place.`;
    }
    if (status === "scheduled") {
      description = `Upcoming ${kind.type.toLowerCase()} for ${name}. ${focusLine}`;
    }

    const createdAt = addDays(when, -4);
    appointments.push({
      id,
      patientId: patient.id,
      providerId: patient.primaryProviderId,
      nurseId: kind.nurseId,
      scheduledAt: when,
      durationMinutes: kind.minutes,
      appointmentType: kind.type,
      status,
      title: appointmentTitle(patient, when),
      description,
      reasonForVisit: focusLine,
      joinToken: status === "scheduled" ? `join_${id}` : null,
      createdAt: createdAt < new Date(patient.createdAt) ? new Date(patient.createdAt) : createdAt,
    });

    if (status !== "completed") {
      missedPrevious = status !== "scheduled";
      return;
    }

    const visitId = `vis_${patient.id}_${pad(index + 1)}`;
    const opening = missedPrevious
      ? `${patient.firstName} missed the previous appointment and returned today. `
      : "";
    missedPrevious = false;
    const scoreLine = `${stage.scoreName} is ${stage.score}.`;
    const summary = `${opening}${historyLine(patient)}. ${focusLine} ${scoreLine} No current suicidal ideation, and no new medication allergy was reported.`;
    const followUp = futureFollowUp(course, index);
    visits.push({
      id: visitId,
      appointmentId: id,
      patientId: patient.id,
      providerId: patient.primaryProviderId,
      visitDate: when,
      chiefComplaint: focusLine,
      clinicalSummary: summary,
      followUpInstructions: followUp,
      status: "completed",
    });
    const nurseLine = kind.nurseId
      ? " Jordan Hale, PMHNP, completed a nursing check-in before the clinician visit."
      : "";
    notes.push({
      id: `nte_${patient.id}_${pad(index + 1)}`,
      visitId,
      patientId: patient.id,
      providerId: patient.primaryProviderId,
      noteType: kind.type === "Psychotherapy" ? "psychotherapy" : kind.type === "Nursing check-in" ? "nursing" : "progress",
      content: `${opening}${name} was seen for ${kind.type.toLowerCase()} at ${formatTod(when)}. ${historyLine(patient)}. ${focusLine} ${scoreLine}${nurseLine} ${followUp}`,
      status: "signed",
      createdAt: when,
      updatedAt: when,
    });
  });

  return { appointments, visits, notes };
}

function futureFollowUp(course, index) {
  if (course === "intake" && index === 0) return "Return in two weeks, sooner if mood or sleep worsens.";
  if (course === "remission") return "Return in two to three months, or sooner if low mood lasts more than two weeks.";
  if (course === "psychosis" || course === "bipolar") return "Return in three to six weeks. Call sooner for lost sleep or a clear mood change.";
  if (index < 2) return "Return in two to three weeks to review the early response.";
  return "Return in about four to eight weeks, keeping the usual weekday and time when the schedule allows.";
}

async function createChunked(rows, write) {
  for (let index = 0; index < rows.length; index += 40) {
    await write(rows.slice(index, index + 40));
  }
}

const MEDS_BY_COURSE = {
  depression: [
    { medicationName: "Sertraline", genericName: "sertraline", dosage: "100 mg", route: "oral", frequency: "every morning", status: "active", startAfterDays: 14 },
    { medicationName: "Bupropion XL", genericName: "bupropion", dosage: "150 mg", route: "oral", frequency: "every morning", status: "discontinued", startAfterDays: 0, durationDays: 45, notes: "Stopped for insomnia and jitteriness." },
  ],
  anxiety: [
    { medicationName: "Escitalopram", genericName: "escitalopram", dosage: "10 mg", route: "oral", frequency: "every morning", status: "active", startAfterDays: 7 },
    { medicationName: "Hydroxyzine", genericName: "hydroxyzine", dosage: "25 mg", route: "oral", frequency: "at bedtime as needed", status: "discontinued", startAfterDays: 7, durationDays: 60, notes: "Stopped after morning grogginess." },
  ],
  "anxiety-stopped": [
    { medicationName: "Sertraline", genericName: "sertraline", dosage: "50 mg", route: "oral", frequency: "every morning", status: "discontinued", startAfterDays: 0, durationDays: 120, notes: "Tapered off after symptoms eased. Therapy continues." },
  ],
  panic: [
    { medicationName: "Sertraline", genericName: "sertraline", dosage: "50 mg", route: "oral", frequency: "every morning", status: "active", startAfterDays: 10 },
    { medicationName: "Lorazepam", genericName: "lorazepam", dosage: "0.5 mg", route: "oral", frequency: "as needed for a panic attack", status: "discontinued", startAfterDays: 0, durationDays: 30, notes: "Short bridge only. Not continued." },
  ],
  bipolar: [
    { medicationName: "Lamotrigine", genericName: "lamotrigine", dosage: "200 mg", route: "oral", frequency: "every evening", status: "active", startAfterDays: 21 },
    { medicationName: "Quetiapine", genericName: "quetiapine", dosage: "50 mg", route: "oral", frequency: "at bedtime", status: "discontinued", startAfterDays: 0, durationDays: 40, notes: "Stopped for daytime sedation once sleep settled." },
  ],
  ptsd: [
    { medicationName: "Sertraline", genericName: "sertraline", dosage: "100 mg", route: "oral", frequency: "every morning", status: "active", startAfterDays: 14 },
    { medicationName: "Prazosin", genericName: "prazosin", dosage: "2 mg", route: "oral", frequency: "at bedtime", status: "discontinued", startAfterDays: 30, durationDays: 70, notes: "Stopped after lightheadedness on standing." },
  ],
  adhd: [
    { medicationName: "Atomoxetine", genericName: "atomoxetine", dosage: "80 mg", route: "oral", frequency: "every morning", status: "active", startAfterDays: 14 },
    { medicationName: "Methylphenidate ER", genericName: "methylphenidate", dosage: "18 mg", route: "oral", frequency: "every morning", status: "discontinued", startAfterDays: 0, durationDays: 28, notes: "Stopped for appetite loss and a racing heart." },
  ],
  intake: [
    { medicationName: "Sertraline", genericName: "sertraline", dosage: "25 mg", route: "oral", frequency: "every morning", status: "active", startAfterDays: 0 },
  ],
  remission: [
    { medicationName: "Escitalopram", genericName: "escitalopram", dosage: "10 mg", route: "oral", frequency: "every morning", status: "discontinued", startAfterDays: 0, durationDays: 180, notes: "Tapered after a stable year. Watching for relapse." },
  ],
  psychosis: [
    { medicationName: "Aripiprazole", genericName: "aripiprazole", dosage: "10 mg", route: "oral", frequency: "every morning", status: "active", startAfterDays: 7 },
    { medicationName: "Risperidone", genericName: "risperidone", dosage: "1 mg", route: "oral", frequency: "at bedtime", status: "discontinued", startAfterDays: 0, durationDays: 35, notes: "Switched after stiffness and restlessness." },
  ],
  performance: [
    { medicationName: "Escitalopram", genericName: "escitalopram", dosage: "10 mg", route: "oral", frequency: "every morning", status: "active", startAfterDays: 14, notes: "For rumination and worry that starts days before a performance." },
    { medicationName: "Propranolol", genericName: "propranolol", dosage: "10 mg", route: "oral", frequency: "about an hour before a performance", status: "active", startAfterDays: 21, notes: "For racing heart and tremor once the event is close." },
    { medicationName: "Hydroxyzine", genericName: "hydroxyzine", dosage: "25 mg", route: "oral", frequency: "at bedtime as needed", status: "discontinued", startAfterDays: 0, durationDays: 40, notes: "Tried for short sleep before events. Stopped after morning grogginess." },
    { medicationName: "Zolpidem", genericName: "zolpidem", dosage: "5 mg", route: "oral", frequency: "at bedtime the night before an evaluation", status: "discontinued", startAfterDays: 45, durationDays: 21, notes: "Short trial for the sleepless night before an evaluation. Stopped because of fog the next morning." },
  ],
};

const MEDS_BY_PATIENT = {
  pat_16: [
    { medicationName: "Escitalopram", genericName: "escitalopram", dosage: "10 mg", route: "oral", frequency: "every morning", status: "active", startAfterDays: 14, notes: "For the worry and replaying that start two days before a performance." },
    { medicationName: "Propranolol", genericName: "propranolol", dosage: "10 mg", route: "oral", frequency: "about an hour before a performance or evaluation", status: "active", startAfterDays: 28, notes: "For racing heart and tremor once the event is close. Not for daily use." },
    { medicationName: "Trazodone", genericName: "trazodone", dosage: "50 mg", route: "oral", frequency: "at bedtime the night before a performance", status: "active", startAfterDays: 60, notes: "For the short sleep the night before an evaluation, after hydroxyzine was stopped." },
    { medicationName: "Hydroxyzine", genericName: "hydroxyzine", dosage: "25 mg", route: "oral", frequency: "at bedtime as needed", status: "discontinued", startAfterDays: 0, durationDays: 50, notes: "First try for pre-event insomnia. Stopped after morning grogginess before rehearsal." },
    { medicationName: "Zolpidem", genericName: "zolpidem", dosage: "5 mg", route: "oral", frequency: "at bedtime the night before an evaluation", status: "discontinued", startAfterDays: 21, durationDays: 18, notes: "Brief trial for the sleepless night before an evaluation. Stopped because of fog the next morning." },
  ],
  pat_29: [
    { medicationName: "Sertraline", genericName: "sertraline", dosage: "50 mg", route: "oral", frequency: "every morning", status: "active", startAfterDays: 14, notes: "For worry in the days before a teaching evaluation." },
    { medicationName: "Propranolol", genericName: "propranolol", dosage: "10 mg", route: "oral", frequency: "about an hour before a teaching evaluation", status: "active", startAfterDays: 21, notes: "For tremor and a racing heart in the classroom." },
    { medicationName: "Trazodone", genericName: "trazodone", dosage: "50 mg", route: "oral", frequency: "at bedtime as needed", status: "discontinued", startAfterDays: 7, durationDays: 45, notes: "Tried for light sleep. Stopped because she was too drowsy to teach the next morning." },
  ],
  pat_15: [
    { medicationName: "Sertraline", genericName: "sertraline", dosage: "100 mg", route: "oral", frequency: "every morning", status: "active", startAfterDays: 14, notes: "For low mood. Dose has been stable since 2025." },
    { medicationName: "Trazodone", genericName: "trazodone", dosage: "50 mg", route: "oral", frequency: "at bedtime", status: "active", startAfterDays: 21, notes: "For insomnia that stayed after mood began to lift." },
    { medicationName: "Methylphenidate ER", genericName: "methylphenidate", dosage: "18 mg", route: "oral", frequency: "every morning", status: "discontinued", startAfterDays: 0, durationDays: 30, notes: "A stimulant trial for low energy. Not continued because of a racing heart and worse sleep." },
  ],
  pat_04: [
    { medicationName: "Sertraline", genericName: "sertraline", dosage: "50 mg", route: "oral", frequency: "every morning", status: "discontinued", startAfterDays: 0, durationDays: 200, notes: "Stopped in early 2026 at the patient's request after social anxiety eased." },
    { medicationName: "Hydroxyzine", genericName: "hydroxyzine", dosage: "25 mg", route: "oral", frequency: "at bedtime as needed", status: "discontinued", startAfterDays: 30, durationDays: 90, notes: "Stopped with the antidepressant. It had been for interrupted sleep." },
  ],
  pat_10: [
    { medicationName: "Escitalopram", genericName: "escitalopram", dosage: "10 mg", route: "oral", frequency: "every morning", status: "active", startAfterDays: 0, notes: "First psychiatric medication, started in this clinic for worry and muscle tension." },
    { medicationName: "Hydroxyzine", genericName: "hydroxyzine", dosage: "25 mg", route: "oral", frequency: "at bedtime as needed", status: "discontinued", startAfterDays: 14, durationDays: 40, notes: "Added for tension at night. Stopped after morning grogginess." },
  ],
};

export async function seedMedications(db, patients) {
  const ids = patients.map((patient) => patient.id);
  await db.medication.deleteMany({ where: { patientId: { in: ids } } });
  const rows = [];
  for (const patient of patients) {
    const course = COURSE_BY_PATIENT[patient.id] ?? "depression";
    const plans = MEDS_BY_PATIENT[patient.id] ?? MEDS_BY_COURSE[course] ?? [];
    const created = new Date(patient.createdAt);
    plans.forEach((plan, index) => {
      const startDate = addDays(created, plan.startAfterDays);
      const endDate = plan.status === "discontinued" ? addDays(startDate, plan.durationDays) : null;
      rows.push({
        id: `med_${patient.id}_${index + 1}`,
        patientId: patient.id,
        prescribingProviderId: patient.primaryProviderId,
        medicationName: plan.medicationName,
        genericName: plan.genericName,
        dosage: plan.dosage,
        route: plan.route,
        frequency: plan.frequency,
        status: plan.status,
        startDate,
        endDate,
        notes: plan.notes ?? null,
      });
    });
  }
  await createChunked(rows, (data) => db.medication.createMany({ data }));
  return rows.length;
}

export async function seedClinicHistory(db, patients) {
  const ids = patients.map((patient) => patient.id);
  await db.clinicalEvent.deleteMany({ where: { patientId: { in: ids } } });
  await db.reminder.deleteMany({ where: { patientId: { in: ids } } });
  await db.prescriptionOrder.deleteMany({ where: { patientId: { in: ids } } });
  await db.intake.deleteMany({ where: { patientId: { in: ids } } });
  await db.clinicalNote.deleteMany({ where: { patientId: { in: ids } } });
  await db.visit.deleteMany({ where: { patientId: { in: ids } } });
  await db.appointment.deleteMany({ where: { patientId: { in: ids } } });

  const appointments = [];
  const visits = [];
  const notes = [];
  for (const patient of patients) {
    const built = recordsFor(patient);
    appointments.push(...built.appointments);
    visits.push(...built.visits);
    notes.push(...built.notes);
  }

  await createChunked(appointments, (data) => db.appointment.createMany({ data }));
  await createChunked(visits, (data) => db.visit.createMany({ data }));
  await createChunked(notes, (data) => db.clinicalNote.createMany({ data }));
  const { applyRoseVisitNotes } = await import("./vary-rose-notes.mjs");
  await applyRoseVisitNotes(db);

  return {
    appointments: appointments.length,
    visits: visits.length,
    notes: notes.length,
  };
}
