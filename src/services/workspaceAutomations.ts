import { USMLERow } from '../types';

export interface AutomationSettings {
  tasksEnableDailyQuota: boolean;
  tasksForceAnki: boolean;
  calendarAutoScheduleWeakness: boolean;
  calendarProtectSpacedRepetition: boolean;
  keepAutoCompilePearls: boolean;
  appsScriptWebhookUrl: string;
}

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  tasksEnableDailyQuota: true,
  tasksForceAnki: true,
  calendarAutoScheduleWeakness: true,
  calendarProtectSpacedRepetition: true,
  keepAutoCompilePearls: true,
  appsScriptWebhookUrl: '',
};

export interface DiagnosticResult {
  is_healthy: boolean;
  missing_data_errors: string[];
}

/**
 * 3. LOGIC: The Self-Diagnostic Check
 * Checks if the row (question data) we are about to sync has all required fields.
 */
export function runSystemDiagnostics(questionData: Partial<USMLERow>, activeExam: string = 'USMLE Step 2 CK'): DiagnosticResult {
  const errors: string[] = [];

  if (!activeExam) {
    errors.push('Cannot sync: Active Exam type is missing.');
  }

  if (!questionData.qid || String(questionData.qid).trim() === '') {
    errors.push('Cannot sync: QID is missing.');
  }

  if (!questionData.system || String(questionData.system).trim() === '') {
    errors.push('Cannot sync: System Category is missing.');
  }

  // Check if at least one attempt is marked as Correct or Incorrect. Omitted is not valid for sync triggers unless specifically handling it.
  const hasAttempt1 = questionData.attempt1 === 'Correct' || questionData.attempt1 === 'Incorrect';
  const hasAttempt2 = questionData.attempt2 === 'Correct' || questionData.attempt2 === 'Incorrect';

  if (!hasAttempt1 && !hasAttempt2) {
    errors.push('Cannot sync: Status (Correct or Incorrect attempt) is missing.');
  }

  return {
    is_healthy: errors.length === 0,
    missing_data_errors: errors
  };
}

/**
 * GENERATOR: The Accountability Engine (Google Tasks)
 * Generates an array of scheduled motivations and/or Anki task mandates based on the daily goal deficit and incorrect questions.
 */
export function generateTasksPayload(
  currentRepCount: number = 0, 
  dailyGoal: number = 40,
  isIncorrectQuestion: boolean,
  qid: string,
  settings: AutomationSettings
) {
  const payload: { scheduled_time?: string; task_title: string }[] = [];
  const deficit = Math.max(0, dailyGoal - currentRepCount);

  // 1. Phased Daily Quota Motivations
  if (settings.tasksEnableDailyQuota && deficit > 0) {
    // Generate phased timeframes to push motivational tasks to Google Tasks API.
    // Replace with Google OAuth / Tasks API insert calls using this JSON payload schema.
    const phases = [
      { time: '05:00:00', prefix: '晨 Discipline:' }, // Morning Formality
      { time: '06:00:00', prefix: 'Morning Focus:' },
      { time: '07:00:00', prefix: 'Prime Time:' },
      { time: '08:00:00', prefix: 'Last Push AM:' },
      { time: '16:30:00', prefix: 'Afternoon Second-Wind:' },
      { time: '17:00:00', prefix: 'Grind Mode:' },
      { time: '19:00:00', prefix: 'Evening Urgency:' },
      { time: '21:00:00', prefix: 'Midnight Oil:' },
    ];
    
    phases.forEach(phase => {
      const now = new Date();
      const [hours, minutes] = phase.time.split(':').map(Number);
      const phaseTime = new Date();
      phaseTime.setHours(hours, minutes, 0, 0);

      // Only schedule phases that are still coming up today
      if (phaseTime > now) {
        payload.push({
          scheduled_time: phase.time,
          task_title: `[${phase.prefix}] You have ${deficit} questions remaining today to hit your quota.`
        });
      }
    });
  }

  // 2. Anki Directive for Incorrects
  if (settings.tasksForceAnki && isIncorrectQuestion && qid) {
    payload.push({
      task_title: `Create Anki card for QID-[${qid}]`
    });
  }

  return payload;
}

/**
 * GENERATOR: Dynamic Scheduling (Google Calendar)
 * Generates spaced repetition payloads and weakness targeted blocks.
 */
export function generateCalendarPayload(
  isIncorrectQuestion: boolean,
  qid: string,
  systemCategory: string,
  systemAccuracy: number,
  settings: AutomationSettings
) {
  const payload: { event_title: string; duration_minutes: number; days_in_future: number; description?: string }[] = [];

  // 1. Spaced Repetition on Incorrects
  if (settings.calendarProtectSpacedRepetition && isIncorrectQuestion) {
    // 3 Days
    payload.push({
      event_title: `Spaced Review: Concept from QID [${qid}] - ${systemCategory}`,
      duration_minutes: 15,
      days_in_future: 3
    });
    // 7 Days
    payload.push({
      event_title: `Spaced Review: Concept from QID [${qid}] - ${systemCategory}`,
      duration_minutes: 15,
      days_in_future: 7
    });
  }

  // 2. Weakness Review
  if (settings.calendarAutoScheduleWeakness && systemAccuracy < 70) {
    // Schedule incoming weekend block (stubbed as 5 days for conceptual payload testing)
    payload.push({
      event_title: `Targeted System Review: ${systemCategory}`,
      duration_minutes: 45,
      days_in_future: 5,
      description: `Your accuracy in ${systemCategory} has dropped below the 70% threshold. Spend this time solidifying core concepts.`
    });
  }

  return payload;
}

/**
 * GENERATOR: The High-Yield Compiler (Google Keep/Docs)
 * Extracts the clinical pearls directly into categorized output mappings.
 */
export function generateKeepDocsPayload(
  clinicalPearlText: string,
  targetCategory: string,
  settings: AutomationSettings
) {
  if (!settings.keepAutoCompilePearls || !clinicalPearlText || String(clinicalPearlText).trim() === '') {
    return null;
  }

  // This payload maps directly into Google Keep note creation API blocks or appending to a specific Google Doc via the Docs API.
  return {
    clinical_pearl_text: `• [${targetCategory}]: ${clinicalPearlText}`,
    target_category: targetCategory
  };
}

/**
 * Central Integration Dispatcher (Simulated Hook Function)
 * Note: Use appropriate Google OAuth wrappers and gapi.client / fetch to Google REST APIs here.
 */
export async function dispatchAutomations(
  questionData: Partial<USMLERow>, 
  systemAccuracy: number, 
  currentDailyCount: number,
  settings: AutomationSettings
) {
  // 1. Run Diagnostic Health Check
  const diagnostics = runSystemDiagnostics(questionData);
  
  if (!diagnostics.is_healthy) {
    console.error("DIAGNOSTIC FAILURE:", diagnostics.missing_data_errors);
    return { success: false, errors: diagnostics.missing_data_errors };
  }

  // Determine standard trigger definitions
  const isIncorrect = questionData.attempt1 === 'Incorrect' || questionData.attempt2 === 'Incorrect';

  // 2. Generate payloads
  const tasksPayload = generateTasksPayload(currentDailyCount, 40, isIncorrect, String(questionData.qid), settings);
  const calendarPayload = generateCalendarPayload(isIncorrect, String(questionData.qid), String(questionData.system), systemAccuracy, settings);
  const keepPayload = generateKeepDocsPayload(String(questionData.studyGuide), String(questionData.system), settings);

  let webhookResponse = null;
  if (settings.appsScriptWebhookUrl && settings.appsScriptWebhookUrl.startsWith('https://script.google.com/macros/')) {
    try {
      const response = await fetch(settings.appsScriptWebhookUrl, {
        method: 'POST',
        // 'text/plain' or no-cors is sometimes needed for Apps Script, but trying standard POST first.
        // Google Apps Script requires a redirect follow and specific body parsing.
        body: JSON.stringify({
          payloads: {
            tasks: tasksPayload,
            calendar: calendarPayload,
            keepAndDocs: keepPayload
          }
        })
      });
      webhookResponse = await response.json();
    } catch (e: any) {
      console.error("Webhook POST failed:", e);
      webhookResponse = { error: e.message };
    }
  }

  return {
    success: true,
    webhookResponse,
    payloads: {
      tasks: tasksPayload,
      calendar: calendarPayload,
      keepAndDocs: keepPayload
    }
  };
}
