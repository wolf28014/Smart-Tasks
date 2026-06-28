import { NextRequest, NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import { rowToTask, inputToCreateData } from "@/lib/task-serializer";
import { aiErrorResponse, chat } from "@/lib/ai-client";
import type { TaskData, TaskInput, Status, Priority } from "@/lib/task-utils";

// POST /api/ai/chat
// Body: {
//   messages: ChatMessage[],         // conversation history
//   context?: { taskId?: string },  // E2: limit scope to one task
//   execute?: {                      // E1 step 2: user confirmed, now execute
//     toolName: string,
//     args: any
//   }
// }
//
// Returns (no execute): {
//   reply: string,                    // LLM's text reply
//   proposedAction?: {                // LLM wants to call a tool — frontend shows confirm UI
//     toolName: string,
//     args: any,
//     description: string             // human-readable summary of what will happen
//   }
// }
// Returns (with execute): {
//   result: any,                      // tool execution result
//   reply: string                     // LLM's follow-up after seeing the result
// }

interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

const TOOLS: ToolDef[] = [
  {
    name: "list_tasks",
    description:
      "查询任务列表。可按状态、优先级、标签过滤，可搜索关键词。返回匹配的任务。",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done", "cancelled"],
          description: "按状态过滤（可选）",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "按优先级过滤（可选）",
        },
        tag: { type: "string", description: "按标签过滤（可选）" },
        q: { type: "string", description: "搜索关键词（可选）" },
        overdue: { type: "boolean", description: "只返回逾期任务（可选）" },
      },
    },
  },
  {
    name: "create_task",
    description: "创建新任务。必须提供 title。",
    parameters: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string", description: "任务标题（必填）" },
        description: { type: "string", description: "任务描述（可选）" },
        dueDate: {
          type: "string",
          description: "截止日期 YYYY-MM-DD（可选）",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "优先级，默认 medium",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "标签列表（可选）",
        },
      },
    },
  },
  {
    name: "update_task",
    description: "修改已有任务。必须提供 taskId 和至少一个要修改的字段。",
    parameters: {
      type: "object",
      required: ["taskId"],
      properties: {
        taskId: { type: "string", description: "要修改的任务 ID" },
        title: { type: "string" },
        description: { type: "string" },
        dueDate: { type: "string", description: "YYYY-MM-DD 或清空传 null" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done", "cancelled"],
        },
        tags: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "delete_task",
    description: "删除任务（移入回收站）。必须提供 taskId。",
    parameters: {
      type: "object",
      required: ["taskId"],
      properties: {
        taskId: { type: "string", description: "要删除的任务 ID" },
      },
    },
  },
];

// --- Tool execution ---

async function listTasks(args: {
  status?: string;
  priority?: string;
  tag?: string;
  q?: string;
  overdue?: boolean;
}): Promise<{ tasks: TaskData[] }> {
  const rows = await db.task.findMany();
  let tasks = rows
    .map(rowToTask)
    .filter((t) => t.deletedAt === null);

  if (args.status) tasks = tasks.filter((t) => t.status === args.status);
  if (args.priority) tasks = tasks.filter((t) => t.priority === args.priority);
  if (args.tag) tasks = tasks.filter((t) => t.tags.includes(args.tag!));
  if (args.q) {
    const q = args.q.toLowerCase();
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }
  if (args.overdue) {
    const today = new Date().toISOString().slice(0, 10);
    tasks = tasks.filter(
      (t) =>
        t.dueDate !== null &&
        t.dueDate < today &&
        t.status !== "done" &&
        t.status !== "cancelled",
    );
  }
  return { tasks };
}

async function createTask(args: TaskInput): Promise<{ task: TaskData }> {
  if (!args.title?.trim()) throw new Error("任务标题不能为空");
  const created = await db.task.create({ data: inputToCreateData(args) });
  return { task: rowToTask(created) };
}

async function updateTask(args: {
  taskId: string;
  title?: string;
  description?: string;
  dueDate?: string | null;
  priority?: Priority;
  status?: Status;
  tags?: string[];
}): Promise<{ task: TaskData }> {
  const data: Record<string, unknown> = {};
  if (args.title !== undefined) data.title = args.title;
  if (args.description !== undefined) data.description = args.description;
  if (args.dueDate !== undefined) data.dueDate = args.dueDate;
  if (args.priority !== undefined) data.priority = args.priority;
  if (args.status !== undefined) data.status = args.status;
  if (args.tags !== undefined) data.tags = JSON.stringify(args.tags);
  const updated = await db.task.update({
    where: { id: args.taskId },
    data,
  });
  return { task: rowToTask(updated) };
}

async function deleteTask(args: {
  taskId: string;
}): Promise<{ ok: boolean }> {
  await db.task.update({
    where: { id: args.taskId },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}

function describeAction(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "list_tasks": {
      const parts: string[] = [];
      if (args.status) parts.push(`状态=${args.status}`);
      if (args.priority) parts.push(`优先级=${args.priority}`);
      if (args.tag) parts.push(`标签=${args.tag}`);
      if (args.q) parts.push(`搜索="${args.q}"`);
      if (args.overdue) parts.push("仅逾期");
      return `查询任务列表${parts.length ? `（${parts.join("、")}）` : "（全部）"}`;
    }
    case "create_task":
      return `创建任务「${args.title}」${args.dueDate ? `，截止 ${args.dueDate}` : ""}`;
    case "update_task": {
      const fields: string[] = [];
      if (args.title !== undefined) fields.push("标题");
      if (args.description !== undefined) fields.push("描述");
      if (args.dueDate !== undefined) fields.push("截止日期");
      if (args.priority !== undefined) fields.push("优先级");
      if (args.status !== undefined) fields.push("状态");
      if (args.tags !== undefined) fields.push("标签");
      return `修改任务 ${args.taskId} 的${fields.join("、")}`;
    }
    case "delete_task":
      return `删除任务 ${args.taskId}（移入回收站）`;
    default:
      return `执行操作 ${toolName}`;
  }
}

// --- Main handler ---

export async function POST(req: NextRequest) {
  const dbCheck = await checkDb();
  if (!dbCheck.ok) {
    return NextResponse.json(
      { error: "数据库连接失败", hint: dbCheck.hint },
      { status: 503 },
    );
  }

  let body: {
    messages?: { role: string; content: string }[];
    context?: { taskId?: string };
    execute?: { toolName: string; args: Record<string, unknown> };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  // --- Branch 2: execute a confirmed action ---
  if (body.execute?.toolName) {
    const { toolName, args } = body.execute;
    try {
      let result: unknown;
      switch (toolName) {
        case "list_tasks":
          result = await listTasks(args as Parameters<typeof listTasks>[0]);
          break;
        case "create_task":
          result = await createTask(args as unknown as TaskInput);
          break;
        case "update_task":
          result = await updateTask(
            args as Parameters<typeof updateTask>[0],
          );
          break;
        case "delete_task":
          result = await deleteTask(args as Parameters<typeof deleteTask>[0]);
          break;
        default:
          return NextResponse.json(
            { error: `未知操作: ${toolName}` },
            { status: 400 },
          );
      }

      // Ask LLM to summarize the result for the user
      const followUp = await chat([
        {
          role: "system",
          content:
            "你是任务助手。用户刚确认执行了一个操作，现在看到结果。用一句话告诉用户结果（不超过 50 字），如果操作失败要明确指出。",
        },
        {
          role: "user",
          content: `执行操作: ${toolName}\n参数: ${JSON.stringify(args)}\n结果: ${JSON.stringify(result).slice(0, 800)}`,
        },
      ]);

      return NextResponse.json({ result, reply: followUp });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `执行失败: ${message}` },
        { status: 500 },
      );
    }
  }

  // --- Branch 1: normal chat turn (may propose an action) ---
  const messages = body.messages ?? [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }

  // Build system prompt
  const today = new Date().toISOString().slice(0, 10);
  let systemPrompt =
    `你是智能待办的 AI 助手。今天是 ${today}。` +
    "你可以回答用户关于任务的问题，也可以提议创建/修改/删除任务。" +
    "当需要操作任务时，调用对应的工具。工具调用会先让用户确认，确认后才真正执行。" +
    "可用工具：\n" +
    TOOLS.map(
      (t) =>
        `- ${t.name}: ${t.description}\n  参数: ${JSON.stringify(t.parameters)}`,
    ).join("\n") +
    "\n\n重要：当你想调用工具时，回复格式为：\n" +
    '{"action":{"toolName":"...","args":{...}}}\n' +
    "此时不要再返回其他文字。当不需要调用工具时，正常回复用户文字即可。";

  // E2: limit context to a specific task
  if (body.context?.taskId) {
    const taskRow = await db.task.findUnique({
      where: { id: body.context.taskId },
    });
    if (taskRow) {
      const task = rowToTask(taskRow);
      systemPrompt += `\n\n当前上下文：用户正在查看任务「${task.title}」（ID: ${task.id}）。如果用户的问题与这个任务相关，优先基于它回答。需要修改这个任务时，update_task 的 taskId 用 "${task.id}"。`;
    }
  }

  try {
    const reply = await chat(
      [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      ],
      { temperature: 0.5 },
    );

    // Check if the reply is a JSON action proposal
    const trimmed = reply.trim();
    // Try to detect {"action": {...}} pattern (possibly wrapped in fences)
    const actionMatch = trimmed.match(
      /(?:^```(?:json)?\s*\n?)?\s*(\{[\s\S]*"action"[\s\S]*\})\s*(?:\n?```\s*$)?$/,
    );

    if (actionMatch) {
      try {
        const parsed = JSON.parse(actionMatch[1]);
        const action = parsed.action;
        if (
          action &&
          typeof action.toolName === "string" &&
          TOOLS.some((t) => t.name === action.toolName)
        ) {
          return NextResponse.json({
            reply: "",
            proposedAction: {
              toolName: action.toolName,
              args: action.args ?? {},
              description: describeAction(action.toolName, action.args ?? {}),
            },
          });
        }
      } catch {
        // Not valid JSON action — fall through to treat as normal reply
      }
    }

    return NextResponse.json({ reply });
  } catch (err) {
    const { status, body: errBody } = aiErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
