// lib/employee-store.js
// In-memory data store for the employee demo.
// Everything here resets when the server restarts — swap for a real
// database (Postgres, etc.) and a real password hash (bcrypt/argon2)
// before shipping this anywhere near production.

import { randomUUID } from "crypto";

const employees = [
  { id: "emp_1", email: "alex@helixon.dev", password: "password123", name: "Alex Rivera" },
  { id: "emp_2", email: "sam@helixon.dev", password: "password123", name: "Sam Okafor" },
];

const todosByEmployee = new Map(); // employeeId -> array of todos
const sessions = new Map(); // token -> employeeId

function seedTodos(employeeId) {
  if (todosByEmployee.has(employeeId)) return;
  const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  todosByEmployee.set(employeeId, [
    {
      id: randomUUID(),
      title: "Review onboarding docs",
      notes: "Check the new-hire checklist for accuracy.",
      priority: "medium",
      due_date: "",
      done: false,
    },
    {
      id: randomUUID(),
      title: "Submit expense report",
      notes: "",
      priority: "high",
      due_date: soon,
      done: false,
    },
    {
      id: randomUUID(),
      title: "Post team standup notes",
      notes: "Posted in #eng-standup",
      priority: "low",
      due_date: "",
      done: true,
    },
  ]);
}

export function findEmployeeByEmail(email) {
  return employees.find((e) => e.email.toLowerCase() === String(email).toLowerCase());
}

export function findEmployeeById(id) {
  return employees.find((e) => e.id === id);
}

export function createSession(employeeId) {
  const token = randomUUID();
  sessions.set(token, employeeId);
  seedTodos(employeeId);
  return token;
}

export function getEmployeeIdForToken(token) {
  if (!token) return null;
  return sessions.get(token) || null;
}

export function destroySession(token) {
  sessions.delete(token);
}

export function getTodos(employeeId) {
  seedTodos(employeeId);
  return todosByEmployee.get(employeeId);
}

export function addTodo(employeeId, { title, notes, priority, due_date }) {
  seedTodos(employeeId);
  const todo = {
    id: randomUUID(),
    title: title.trim(),
    notes: notes || "",
    priority: priority || "medium",
    due_date: due_date || "",
    done: false,
  };
  todosByEmployee.get(employeeId).unshift(todo);
  return todo;
}

export function updateTodo(employeeId, id, updates) {
  const list = getTodos(employeeId);
  const todo = list.find((t) => t.id === id);
  if (!todo) return null;
  for (const key of ["title", "notes", "priority", "due_date", "done"]) {
    if (updates[key] !== undefined) todo[key] = updates[key];
  }
  return todo;
}

export function deleteTodo(employeeId, id) {
  const list = getTodos(employeeId);
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

export function getStats() {
  // Read-only subset of admin stats — safe for employee eyes.
  return {
    totalUsers: 4213,
    activeToday: 318,
    uptimePct: 99.97,
    openTickets: 12,
  };
}
