import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const BOARDS_FILE = path.join(process.cwd(), "data", "kanban-boards.json");
const COLUMNS_FILE = path.join(process.cwd(), "data", "kanban-columns.json");
const TASKS_FILE = path.join(process.cwd(), "data", "kanban.json");

type KanbanBoard = {
  id: string;
  title: string;
  createdAt: string;
};

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

const DEFAULT_BOARDS: KanbanBoard[] = [
  {
    id: "default",
    title: "Tableau principal",
    createdAt: new Date().toISOString(),
  },
];

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

async function readBoards(): Promise<KanbanBoard[]> {
  try {
    const file = await fs.readFile(BOARDS_FILE, "utf-8");
    return JSON.parse(file);
  } catch {
    return DEFAULT_BOARDS;
  }
}

async function writeBoards(boards: KanbanBoard[]) {
  await fs.mkdir(path.dirname(BOARDS_FILE), { recursive: true });
  await fs.writeFile(BOARDS_FILE, JSON.stringify(boards, null, 2), "utf-8");
}

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

export async function GET() {
  const boards = await readBoards();
  return NextResponse.json(boards);
}

export async function POST(req: NextRequest) {
  const { title } = await req.json();
  const boards = await readBoards();

  if (boards.length >= 3) {
    return NextResponse.json(
      { error: "Maximum 3 tableaux autorisés" },
      { status: 400 },
    );
  }

  const newBoard: KanbanBoard = {
    id: Date.now().toString(),
    title: title || "Nouveau tableau",
    createdAt: new Date().toISOString(),
  };

  const updatedBoards = [...boards, newBoard];
  await writeBoards(updatedBoards);

  // Créer les colonnes par défaut pour ce nouveau tableau
  const columns = await readColumns();
  const defaultColumns: KanbanColumn[] = [
    {
      id: `${newBoard.id}-todo`,
      title: "À faire",
      status: "todo",
      boardId: newBoard.id,
      order: 0,
    },
    {
      id: `${newBoard.id}-in_progress`,
      title: "En cours",
      status: "in_progress",
      boardId: newBoard.id,
      order: 1,
    },
    {
      id: `${newBoard.id}-done`,
      title: "Terminé",
      status: "done",
      boardId: newBoard.id,
      order: 2,
    },
  ];

  const updatedColumns = [...columns, ...defaultColumns];
  await writeColumns(updatedColumns);

  return NextResponse.json(newBoard, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const boards = await readBoards();

  if (boards.length <= 1) {
    return NextResponse.json(
      { error: "Impossible de supprimer le dernier tableau" },
      { status: 400 },
    );
  }

  const updatedBoards = boards.filter((b) => b.id !== id);
  await writeBoards(updatedBoards);

  // Supprimer les colonnes et tâches associées
  const columns = await readColumns();
  const updatedColumns = columns.filter((c) => c.boardId !== id);
  await writeColumns(updatedColumns);

  const tasks = await readTasks();
  const updatedTasks = tasks.filter((t) => t.boardId !== id);
  await writeTasks(updatedTasks);

  return NextResponse.json({ ok: true });
}
