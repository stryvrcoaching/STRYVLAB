import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const COLUMNS_FILE = path.join(process.cwd(), "data", "kanban-columns.json");
const TASKS_FILE = path.join(process.cwd(), "data", "kanban.json");

type KanbanColumn = {
  id: string;
  title: string;
  status: string;
  boardId: string;
  order: number;
};

type KanbanTask = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: "high" | "medium" | "low";
  boardId: string;
  columnId: string;
};

const DEFAULT_COLUMNS: KanbanColumn[] = [
  {
    id: "todo",
    title: "À faire",
    status: "todo",
    boardId: "default",
    order: 0,
  },
  {
    id: "in_progress",
    title: "En cours",
    status: "in_progress",
    boardId: "default",
    order: 1,
  },
  {
    id: "done",
    title: "Terminé",
    status: "done",
    boardId: "default",
    order: 2,
  },
];

async function readColumns(): Promise<KanbanColumn[]> {
  try {
    const file = await fs.readFile(COLUMNS_FILE, "utf-8");
    return JSON.parse(file);
  } catch {
    return DEFAULT_COLUMNS;
  }
}

async function writeColumns(columns: KanbanColumn[]) {
  await fs.mkdir(path.dirname(COLUMNS_FILE), { recursive: true });
  await fs.writeFile(COLUMNS_FILE, JSON.stringify(columns, null, 2), "utf-8");
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const boardId = searchParams.get("boardId");

  const columns = await readColumns();
  if (boardId) {
    return NextResponse.json(columns.filter((c) => c.boardId === boardId));
  }
  return NextResponse.json(columns);
}

export async function POST(req: NextRequest) {
  const { title, boardId } = await req.json();
  const columns = await readColumns();

  // Générer un status unique pour cette colonne
  const existingStatuses = columns.map((c) => c.status);
  let newStatus = title.toLowerCase().replace(/\s+/g, "_");
  let counter = 1;
  while (existingStatuses.includes(newStatus)) {
    newStatus = `${title.toLowerCase().replace(/\s+/g, "_")}_${counter}`;
    counter++;
  }

  const maxOrder = Math.max(
    ...columns.filter((c) => c.boardId === boardId).map((c) => c.order),
    -1,
  );
  const newColumn: KanbanColumn = {
    id: Date.now().toString(),
    title: title || "Nouvelle colonne",
    status: newStatus,
    boardId,
    order: maxOrder + 1,
  };

  const updatedColumns = [...columns, newColumn];
  await writeColumns(updatedColumns);

  return NextResponse.json(newColumn, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const columns = await req.json();
  await writeColumns(columns);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const columns = await readColumns();
  const tasks = await readTasks();

  const columnToDelete = columns.find((c) => c.id === id);
  if (!columnToDelete) {
    return NextResponse.json({ error: "Colonne non trouvée" }, { status: 404 });
  }

  // Vérifier qu'il reste au moins une colonne dans ce board
  const boardColumns = columns.filter(
    (c) => c.boardId === columnToDelete.boardId && c.id !== id,
  );
  if (boardColumns.length === 0) {
    return NextResponse.json(
      { error: "Impossible de supprimer la dernière colonne" },
      { status: 400 },
    );
  }

  // Supprimer la colonne
  const updatedColumns = columns.filter((c) => c.id !== id);
  await writeColumns(updatedColumns);

  // Déplacer les tâches vers la première colonne restante
  const firstRemainingColumn = boardColumns[0];
  const updatedTasks = tasks.map((t) =>
    t.columnId === id ? { ...t, columnId: firstRemainingColumn.id } : t,
  );
  await writeTasks(updatedTasks);

  return NextResponse.json({ ok: true });
}
