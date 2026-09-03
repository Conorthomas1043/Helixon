// lib/onboarding-tasks.js
// The onboarding checklist itself — task keys, labels, order. Lives in
// code rather than a database table since it changes rarely and doesn't
// need its own admin UI yet. Completion state per employee lives in
// Supabase (employee_onboarding_progress table, see
// lib/employee-onboarding.js). Edit this array to change the checklist —
// task_key values are permanent identifiers, so avoid renaming an existing
// key once employees may have completed it (add a new one instead).
//
// This is a starting template — adjust the steps to match how Helixon
// actually onboards someone.

export const ONBOARDING_TASKS = [
  {
    key: "account-setup",
    label: "Set your password and confirm you can log in",
    description: "Log in at /employee/login with the credentials an admin created for you.",
  },
  {
    key: "read-handbook",
    label: "Read the team handbook",
    description: "Skim through team norms, tools, and how we work.",
  },
  {
    key: "security-basics",
    label: "Review security basics",
    description: "Password manager, 2FA where available, and what to do if you spot something suspicious.",
  },
  {
    key: "meet-team",
    label: "Meet your team lead",
    description: "A short intro call to go over what you'll be working on first.",
  },
  {
    key: "first-task",
    label: "Complete your first assigned task",
    description: "Check My Tasks or Team Tasks for something to start on.",
  },
];

export function onboardingTaskKeys() {
  return ONBOARDING_TASKS.map((t) => t.key);
}
