import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as path from "path";

export const runtime = "nodejs";

const TASKS_FILE = path.join(process.cwd(), "data", "kanban.json");
const EVENTS_FILE = path.join(process.cwd(), "data", "agenda.json");
const COLUMNS_FILE = path.join(process.cwd(), "data", "kanban-columns.json");

type KanbanTask = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: "high" | "medium" | "low";
  boardId: string;
  columnId: string;
};

type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  priority?: "high" | "medium" | "low";
};

type KanbanColumn = {
  id: string;
  title: string;
  status: string;
  boardId: string;
  order: number;
};

async function readTasks(): Promise<KanbanTask[]> {
  try {
    const file = await fs.readFile(TASKS_FILE, "utf-8");
    const tasks = JSON.parse(file);
    // Migration: si les tâches ont un champ status au lieu de boardId/columnId, les migrer
    return tasks.map((task: any) => {
      if (task.status && !task.boardId) {
        return {
          ...task,
          boardId: "default",
          columnId:
            task.status === "todo"
              ? "todo"
              : task.status === "in_progress"
                ? "in_progress"
                : "done",
        };
      }
      return task;
    });
  } catch {
    return [];
  }
}

async function writeTasks(tasks: KanbanTask[]) {
  await fs.mkdir(path.dirname(TASKS_FILE), { recursive: true });
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
}

async function readEvents(): Promise<AgendaEvent[]> {
  try {
    const file = await fs.readFile(EVENTS_FILE, "utf-8");
    return JSON.parse(file);
  } catch {
    return [];
  }
}

async function writeEvents(events: AgendaEvent[]) {
  await fs.mkdir(path.dirname(EVENTS_FILE), { recursive: true });
  await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
}

async function readColumns(): Promise<KanbanColumn[]> {
  try {
    const file = await fs.readFile(COLUMNS_FILE, "utf-8");
    return JSON.parse(file);
  } catch {
    return [];
  }
}

async function syncTaskToAgenda(task: KanbanTask) {
  if (!task.dueDate) return;

  const columns = await readColumns();
  const column = columns.find((c) => c.id === task.columnId);
  if (!column) return;

  const events = await readEvents();
  const existingIndex = events.findIndex((e) => e.id === task.id);

  const agendaEvent: AgendaEvent = {
    id: task.id,
    title: task.title,
    date: task.dueDate,
    description: task.description,
    priority: task.priority,
  };

  if (existingIndex >= 0) {
    events[existingIndex] = agendaEvent;
  } else {
    events.push(agendaEvent);
  }

  await writeEvents(events);
}

async function removeTaskFromAgenda(taskId: string) {
  const events = await readEvents();
  const filtered = events.filter((e) => e.id !== taskId);
  await writeEvents(filtered);
}

async function syncAllTasksToAgenda(tasks: KanbanTask[]) {
  const events = await readEvents();
  const taskMap = new Map(tasks.filter((t) => t.dueDate).map((t) => [t.id, t]));

  // Update existing events
  const updatedEvents = events.map((event) => {
    const task = taskMap.get(event.id);
    if (task) {
      return {
        id: task.id,
        title: task.title,
        date: task.dueDate!,
        description: task.description,
        priority: task.priority,
      };
    }
    return event;
  });

  // Add new events for tasks with dueDate that don't exist in agenda
  for (const task of tasks) {
    if (task.dueDate && !updatedEvents.some((e) => e.id === task.id)) {
      updatedEvents.push({
        id: task.id,
        title: task.title,
        date: task.dueDate,
        description: task.description,
        priority: task.priority,
      });
    }
  }

  // Remove events that no longer have dueDate
  const finalEvents = updatedEvents.filter((event) => {
    const task = taskMap.get(event.id);
    return task && task.dueDate;
  });

  await writeEvents(finalEvents);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");

    if (!boardId) {
      return NextResponse.json(
        { error: "boardId is required" },
        { status: 400 },
      );
    }

    const tasks = await readTasks();
    const boardTasks = tasks.filter((task) => task.boardId === boardId);

    return NextResponse.json(boardTasks);
  } catch (error) {
    console.error("Error reading tasks:", error);
    return NextResponse.json(
      { error: "Failed to read tasks" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, dueDate, priority, boardId, columnId } = body;

    if (!title || !boardId || !columnId) {
      return NextResponse.json(
        { error: "title, boardId, and columnId are required" },
        { status: 400 },
      );
    }

    const tasks = await readTasks();
    const newTask: KanbanTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      dueDate,
      priority,
      boardId,
      columnId,
    };

    tasks.push(newTask);
    await writeTasks(tasks);

    // Sync to agenda if dueDate is provided
    if (dueDate) {
      await syncTaskToAgenda(newTask);
    }

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, description, dueDate, priority, boardId, columnId } =
      body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const tasks = await readTasks();
    const taskIndex = tasks.findIndex((task) => task.id === id);

    if (taskIndex === -1) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const updatedTask: KanbanTask = {
      ...tasks[taskIndex],
      title: title ?? tasks[taskIndex].title,
      description: description ?? tasks[taskIndex].description,
      dueDate: dueDate ?? tasks[taskIndex].dueDate,
      priority: priority ?? tasks[taskIndex].priority,
      boardId: boardId ?? tasks[taskIndex].boardId,
      columnId: columnId ?? tasks[taskIndex].columnId,
    };

    tasks[taskIndex] = updatedTask;
    await writeTasks(tasks);

    // Sync to agenda
    await syncTaskToAgenda(updatedTask);

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const tasks = await readTasks();
    const filteredTasks = tasks.filter((task) => task.id !== id);

    if (filteredTasks.length === tasks.length) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await writeTasks(filteredTasks);

    // Remove from agenda
    await removeTaskFromAgenda(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 },
    );
  }
}
