// lib/employee-onboarding.js
// Supabase-backed CRUD for `employee_onboarding_progress` - tracks which
// onboarding checklist items (see lib/onboarding-tasks.js) a given
// employee has completed, and when.

import { supabase } from "@/lib/supabase";
import { ONBOARDING_TASKS, onboardingTaskKeys } from "@/lib/onboarding-tasks";

export async function getOnboardingProgress(employeeId) {
  const { data, error } = await supabase
    .from("employee_onboarding_progress")
    .select("task_key,completed_at")
    .eq("employee_id", employeeId);

  if (error) {
    console.error("[employee-onboarding] getOnboardingProgress failed:", error.message);
    return { tasks: ONBOARDING_TASKS.map((t) => ({ ...t, completed: false, completedAt: null })), completedCount: 0, totalCount: ONBOARDING_TASKS.length };
  }

  const completedMap = new Map((data || []).map((row) => [row.task_key, row.completed_at]));
  const validKeys = new Set(onboardingTaskKeys());

  const tasks = ONBOARDING_TASKS.map((t) => ({
    ...t,
    completed: completedMap.has(t.key),
    completedAt: completedMap.get(t.key) || null,
  }));

  // Only count completions against tasks that still exist in the current
  // checklist - if a task_key was removed from ONBOARDING_TASKS, a stale
  // completion row shouldn't inflate the percentage.
  const completedCount = tasks.filter((t) => t.completed).length;

  return { tasks, completedCount, totalCount: ONBOARDING_TASKS.length, validKeys };
}

export async function setOnboardingTaskState(employeeId, taskKey, completed) {
  if (!onboardingTaskKeys().includes(taskKey)) {
    return { ok: false, error: "Unknown onboarding task." };
  }

  if (completed) {
    const { error } = await supabase
      .from("employee_onboarding_progress")
      .upsert({ employee_id: employeeId, task_key: taskKey, completed_at: new Date().toISOString() }, { onConflict: "employee_id,task_key" });

    if (error) {
      console.error("[employee-onboarding] setOnboardingTaskState (complete) failed:", error.message);
      return { ok: false, error: "Could not save progress." };
    }
  } else {
    const { error } = await supabase
      .from("employee_onboarding_progress")
      .delete()
      .eq("employee_id", employeeId)
      .eq("task_key", taskKey);

    if (error) {
      console.error("[employee-onboarding] setOnboardingTaskState (uncomplete) failed:", error.message);
      return { ok: false, error: "Could not save progress." };
    }
  }

  return { ok: true };
}
