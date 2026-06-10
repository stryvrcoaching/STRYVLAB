import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const EVENTS_FILE = path.join(process.cwd(), "data", "agenda.json");
const TASKS_FILE = path.join(process.cwd(), "data", "kanban.json");

type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  priority?: "high" | "medium" | "low";
};

type KanbanTask = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: "high" | "medium" | "low";
  status: "todo" | "in_progress" | "done";
};

const DEFAULT_EVENTS: AgendaEvent[] = [];

async function readEvents(): Promise<AgendaEvent[]> {
  try {
    const file = await fs.readFile(EVENTS_FILE, "utf-8");
    return JSON.parse(file) as AgendaEvent[];
  } catch {
    return DEFAULT_EVENTS;
  }
}

async function writeEvents(events: AgendaEvent[]) {
  await fs.mkdir(path.dirname(EVENTS_FILE), { recursive: true });
  await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
}

async function readTasks(): Promise<KanbanTask[]> {
  try {
    const file = await fs.readFile(TASKS_FILE, "utf-8");
    return JSON.parse(file);
  } catch {
    return [];
  }
}

async function writeTasks(tasks: KanbanTask[]) {
  await fs.mkdir(path.dirname(TASKS_FILE), { recursive: true });
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
}

async function syncEventToKanban(event: AgendaEvent) {
  const tasks = await readTasks();
  const existingIndex = tasks.findIndex((t) => t.id === event.id);

  const kanbanTask: KanbanTask = {
    id: event.id,
    title: event.title,
    description: event.description,
    dueDate: event.date,
    priority: event.priority,
    status: "todo", // Default status for new agenda events
  };

  if (existingIndex >= 0) {
    // Update existing task, preserve status
    tasks[existingIndex] = { ...tasks[existingIndex], ...kanbanTask };
  } else {
    tasks.push(kanbanTask);
  }

  await writeTasks(tasks);
}

async function removeEventFromKanban(eventId: string) {
  const tasks = await readTasks();
  const filtered = tasks.filter((t) => t.id !== eventId);
  await writeTasks(filtered);
}

async function syncAllEventsToKanban(events: AgendaEvent[]) {
  const tasks = await readTasks();
  const eventMap = new Map(events.map((e) => [e.id, e]));

  // Update existing tasks
  const updatedTasks = tasks.map((task) => {
    const event = eventMap.get(task.id);
    if (event) {
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        dueDate: event.date,
        priority: event.priority,
        status: task.status, // Preserve existing status
      };
    }
    return task;
  });

  // Add new tasks for events that don't exist in kanban
  for (const event of events) {
    if (!updatedTasks.some((t) => t.id === event.id)) {
      updatedTasks.push({
        id: event.id,
        title: event.title,
        description: event.description,
        dueDate: event.date,
        priority: event.priority,
        status: "todo",
      });
    }
  }

  // Remove tasks that no longer exist in events
  const finalTasks = updatedTasks.filter((task) => eventMap.has(task.id));

  await writeTasks(finalTasks);
}

export async function GET() {
  const events = await readEvents();
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const events = await readEvents();
  const newEvent: AgendaEvent = { ...data, id: Date.now().toString() };
  const nextEvents = [...events, newEvent];
  await writeEvents(nextEvents);

  // Sync to kanban
  await syncEventToKanban(newEvent);

  return NextResponse.json(newEvent, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const data = await req.json();
  await writeEvents(data);

  // Sync all events to kanban
  await syncAllEventsToKanban(data);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const events = await readEvents();
  const nextEvents = events.filter((e) => e.id !== id);
  await writeEvents(nextEvents);

  // Remove from kanban
  await removeEventFromKanban(id);

  return NextResponse.json({ ok: true });
}
