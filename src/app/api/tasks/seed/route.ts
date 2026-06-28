import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/tasks/seed — populate the database with sample tasks (idempotent:
// only seeds when the table is empty).
export async function POST() {
  const count = await db.task.count();
  if (count > 0) {
    return NextResponse.json({ seeded: false, message: "已有任务，跳过种子数据" });
  }

  const today = new Date();
  const iso = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const samples = [
    {
      title: "完成季度产品规划文档",
      description: "整理 Q3 的产品路线图，包含目标、关键里程碑和资源分配。",
      dueDate: iso(2),
      priority: "high" as const,
      status: "in_progress" as const,
      tags: ["工作", "规划"],
      subtasks: [
        { id: "s1", title: "收集各部门需求", done: true },
        { id: "s2", title: "梳理优先级", done: true },
        { id: "s3", title: "撰写草案", done: false },
        { id: "s4", title: "评审会议", done: false },
      ],
      recurrence: null,
      dependsOn: [],
      pomodoros: 4,
      noteMarkdown:
        "# Q3 规划要点\n\n- 目标：DAU 提升 30%\n- 关键里程碑：\n  - 7 月：用户调研\n  - 8 月：MVP 上线\n  - 9 月：全量发布\n\n> **注意**：需要与设计团队同步资源排期。\n\n## 待确认事项\n\n1. 是否引入新设计系统？\n2. 数据看板是否复用 v1.2 版本？\n\n## 相关任务\n\n- 重构用户认证模块可参考 [[重构用户认证模块]]\n- 调研结果见 [[调研消息队列选型]]",
    },
    {
      title: "每日阅读 30 分钟",
      description: "技术书籍或行业文章，培养持续学习的习惯。",
      dueDate: iso(0),
      priority: "low" as const,
      status: "todo" as const,
      tags: ["学习", "习惯"],
      subtasks: [],
      recurrence: "daily" as const,
      dependsOn: [],
      pomodoros: 1,
      noteMarkdown: null,
    },
    {
      title: "重构用户认证模块",
      description: "迁移到 NextAuth.js v4，统一登录、注册、找回密码流程。",
      dueDate: iso(7),
      priority: "high" as const,
      status: "todo" as const,
      tags: ["开发", "重构"],
      subtasks: [
        { id: "s1", title: "梳理现有流程", done: false },
        { id: "s2", title: "接入 NextAuth", done: false },
        { id: "s3", title: "补全单测", done: false },
      ],
      recurrence: null,
      dependsOn: [],
      pomodoros: 0,
    },
    {
      title: "整理本周项目周报",
      description: "汇总进度、风险、下周计划，发送给团队。",
      dueDate: iso(-1),
      priority: "medium" as const,
      status: "todo" as const,
      tags: ["工作", "汇报"],
      subtasks: [],
      recurrence: "weekly" as const,
      dependsOn: [],
      pomodoros: 2,
    },
    {
      title: "回复客户邮件",
      description: "处理积压的客户咨询邮件，特别是合同条款相关的疑问。",
      dueDate: iso(0),
      priority: "medium" as const,
      status: "todo" as const,
      tags: ["客户"],
      subtasks: [],
      recurrence: null,
      dependsOn: [],
      pomodoros: 0,
    },
    {
      title: "学习 React Server Components",
      description: "阅读官方文档并完成一个 Demo 项目。",
      dueDate: iso(14),
      priority: "low" as const,
      status: "in_progress" as const,
      tags: ["学习", "前端"],
      subtasks: [
        { id: "s1", title: "读官方文档", done: true },
        { id: "s2", title: "写 Demo", done: false },
      ],
      recurrence: null,
      dependsOn: [],
      pomodoros: 3,
    },
    {
      title: "健身房训练 - 上肢日",
      description: "推、拉、肩部训练，60 分钟。",
      dueDate: iso(1),
      priority: "low" as const,
      status: "todo" as const,
      tags: ["健康", "习惯"],
      subtasks: [],
      recurrence: "weekly" as const,
      dependsOn: [],
      pomodoros: 0,
    },
    {
      title: "整理 6 月家庭开支",
      description: "分类记录本月各项开支，更新到预算表。",
      dueDate: iso(3),
      priority: "medium" as const,
      status: "todo" as const,
      tags: ["生活", "理财"],
      subtasks: [
        { id: "s1", title: "收集票据", done: false },
        { id: "s2", title: "录入账单", done: false },
        { id: "s3", title: "对比预算", done: false },
      ],
      recurrence: "monthly" as const,
      dependsOn: [],
      pomodoros: 0,
    },
    {
      title: "上线 v1.2 版本",
      description: "已完成所有功能验证，发布到生产环境并通知用户。",
      dueDate: iso(-3),
      priority: "high" as const,
      status: "done" as const,
      tags: ["工作", "发布"],
      subtasks: [
        { id: "s1", title: "代码冻结", done: true },
        { id: "s2", title: "回归测试", done: true },
        { id: "s3", title: "灰度发布", done: true },
        { id: "s4", title: "全量发布", done: true },
      ],
      recurrence: null,
      dependsOn: [],
      pomodoros: 6,
    },
    {
      title: "调研消息队列选型",
      description: "对比 Kafka、RabbitMQ、NATS，输出选型报告。",
      dueDate: iso(5),
      priority: "medium" as const,
      status: "in_progress" as const,
      tags: ["调研", "架构"],
      subtasks: [
        { id: "s1", title: "Kafka 调研", done: true },
        { id: "s2", title: "RabbitMQ 调研", done: true },
        { id: "s3", title: "NATS 调研", done: false },
        { id: "s4", title: "选型报告", done: false },
      ],
      recurrence: null,
      dependsOn: [],
      pomodoros: 5,
      noteMarkdown:
        "# 消息队列选型对比\n\n| 维度 | Kafka | RabbitMQ | NATS |\n|------|-------|----------|------|\n| 吞吐 | 极高 | 中 | 高 |\n| 延迟 | 中 | 低 | 极低 |\n| 持久化 | 强 | 强 | 可选 |\n| 学习曲线 | 陡 | 平 | 平 |\n\n## 倾向\n\n内部业务量中等，但需要低延迟推送，**NATS** 是较优解。",
    },
    {
      title: "取消旧服务器的订阅",
      description: "已迁移到新云厂商，取消旧的月付订阅避免继续扣费。",
      dueDate: iso(-7),
      priority: "low" as const,
      status: "cancelled" as const,
      tags: ["运维"],
      subtasks: [],
      recurrence: null,
      dependsOn: [],
      pomodoros: 0,
    },
    {
      title: "准备团队季度复盘会议",
      description: "整理数据、邀请参会者、准备议程与讨论提纲。",
      dueDate: iso(10),
      priority: "high" as const,
      status: "todo" as const,
      tags: ["工作", "复盘"],
      subtasks: [
        { id: "s1", title: "整理数据", done: false },
        { id: "s2", title: "发送邀请", done: false },
        { id: "s3", title: "准备议程", done: false },
      ],
      recurrence: null,
      dependsOn: [],
      pomodoros: 0,
    },
  ];

  for (const s of samples) {
    await db.task.create({
      data: {
        title: s.title,
        description: s.description,
        dueDate: s.dueDate,
        priority: s.priority,
        status: s.status,
        recurrence: s.recurrence,
        tags: JSON.stringify(s.tags),
        subtasks: JSON.stringify(s.subtasks),
        dependsOn: JSON.stringify(s.dependsOn),
        pomodoros: s.pomodoros,
        noteMarkdown: s.noteMarkdown ?? null,
        completedAt:
          s.status === "done" ? new Date(iso(-3) + "T18:00:00") : null,
      },
    });
  }

  return NextResponse.json({ seeded: true, count: samples.length });
}
