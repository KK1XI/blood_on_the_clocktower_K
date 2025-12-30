# 2025.12.23 初次访问内容总结与概览 (Initial Access Summary and Overview)

**归档日期**: 2025-12-23  
**执行模型**: Gemini-3-Pro-Preview  
**文件状态**: 初版归档

---

## 1. 项目整体概述 (Project Overview)

**项目名称**: `blood_on_the_clocktower_K`  
**核心目标**: 构建一个《血染钟楼》（Blood on the Clocktower）桌面游戏的**说书人（Storyteller）辅助系统**。  
**应用形态**: Web 应用程序（Browser-based Tool）。  
**当前状态**: 核心功能已完成，处于可运行的原型/MVP（最小可行性产品）阶段。

该系统旨在帮助说书人管理复杂的游戏状态，包括：

- 角色分配与设置。
- 夜间行动顺序引导。
- 信息生成（如占卜师、共情者等角色的信息反馈）。
- 白天的提名、投票与处决流程。
- 玩家状态追踪（存活/死亡、中毒、醉酒、保护等）。

---

## 2. 文件与工程结构 (File & Project Structure)

项目采用标准的 Python Flask 轻量级 Web 应用结构。

```text
blood_on_the_clocktower_K/
├── main.py                     # [后端核心] Flask 应用入口，API 路由定义，游戏状态管理
├── game_data.py                # [数据中心] 包含剧本(TB/BMR/SnV)、角色技能、夜间顺序、阶段定义
├── templates/
│   └── index.html              # [前端入口] 单页应用 (SPA) 结构的 HTML 模板
├── static/
│   ├── css/
│   │   └── style.css           # [样式表] 深色哥特风格 UI，包含响应式布局与动画
│   └── js/
│       └── app.js              # [前端逻辑] 负责 UI 渲染、API 交互、弹窗控制、状态同步
├── blood_on_the_clocktower_K_docs_temp_scripts/  # [文档/脚本] 临时归档目录 (已加入 gitignore)
└── .gitignore                  # [配置] 版本控制忽略规则
```

---

## 3. 已完成内容 (Completed Features)

### 3.1 后端逻辑 (`main.py`, `game_data.py`)

- **游戏核心类 (`Game`)**: 实现了完整的状态机，包括玩家管理、阶段流转（Setup -> Night -> Day）。
- **剧本数据**: 内置了三个官方剧本数据：
  - *Trouble Brewing* (暗流涌动)
  - *Bad Moon Rising* (黯月初升)
  - *Sects & Violets* (梦殒春宵)
- **角色分配算法**:
  - **随机分配**: 根据玩家人数自动计算板子（镇民/外来者/爪牙/恶魔数量），包含含特殊规则（如男爵、教父）的逻辑处理。
  - **手动分配**: 支持说书人完全自定义。
- **夜间结算引擎**:
  - **自动排序**: 根据 `night_order` 自动生成每晚的唤醒顺序。
  - **智能辅助**: 为特定角色（如洗衣妇、共情者、厨师、占卜师等）**自动生成**游戏信息，考虑了中毒/醉酒逻辑。
  - **状态处理**: 处理击杀、保护、中毒、醉酒（包括侍臣、水手等复杂逻辑）。
  - **特殊角色逻辑**: 实现了如普卡（Pukka）延迟击杀、祖母（Grandmother）认亲、管家（Butler）强制投票等复杂机制。
- **白天流程**:
  - **提名与投票**: 完整的提名验证、投票统计、票数阈值计算。
  - **处决结算**: 自动判定处决结果及游戏结束条件（善/恶胜利）。

### 3.2 前端交互 (`index.html`, `app.js`, `style.css`)

- **视觉风格**: 采用暗色调、Cinzel 字体，营造神秘氛围。
- **座位圆盘**: 动态渲染玩家座位，直观显示状态图标（死亡、中毒、醉酒、技能已用）。
- **向导式操作**:
  - **夜间模式**: 逐步引导说书人进行每个角色的唤醒，提供操作面板。
  - **白天模式**: 提名与投票的图形化界面。
- **日志系统**: 实时记录游戏内的关键事件（非公开信息也会记录给说书人看）。

---

## 4. 未完成内容与潜在缺憾 (Missing & Limitations)

1. **数据持久化 (Persistence)**:
    - 目前使用内存字典 `games = {}` 存储。
    - **风险**: 服务器重启或进程崩溃将导致**所有游戏进度丢失**。
    - *建议*: 引入 SQLite 或 JSON 文件存储。
2. **多端实时同步 (Real-time Sync)**:
    - 目前是传统的 HTTP 请求模式。虽然前端可能有轮询（未细看），但主要依赖操作触发更新。
    - **缺失**: 没有 WebSocket，不支持多设备协同（例如玩家想用手机看自己的身份，或者观众端）。目前仅作为“说书人单机控制台”使用。
3. **测试覆盖 (Testing)**:
    - 未发现单元测试（`tests/` 目录缺失）。核心逻辑（如复杂的醉酒/中毒交互）缺乏自动化验证保障。
4. **工程化配置**:
    - 缺少 `requirements.txt` 或 `Pipfile` 依赖描述。
    - 缺少 `README.md` 说明如何启动。

---

## 5. 接下来的建议步骤 (Next Steps)

按照优先级推荐：

1. **工程标准化 (Engineering Standard)**:
    - 创建 `requirements.txt` (包含 `Flask`)。
    - 编写 `README.md`。
2. **数据安全 (Data Safety)**:
    - 实现简单的文件持久化，每步操作后将 `Game` 对象序列化保存到磁盘，防止意外丢失。
3. **功能增强 (Feature Enhancement)**:
    - **自定义剧本**: 允许导入 JSON 格式的自定义剧本。
    - **撤销功能 (Undo)**: 误操作是常态，当前缺乏回滚上一步操作的机制。
4. **代码重构 (Refactoring)**:
    - `main.py` 目前承载了过多逻辑（路由+业务），建议将 `Game` 类拆分到独立文件，路由也按功能模块拆分。

---

## 6. 技术栈总结 (Tech Stack)

- **Language**: Python 3.x, JavaScript (ES6+)
- **Backend Framework**: Flask
- **Frontend**: HTML5, CSS3 (Variables, Flex/Grid), Vanilla JS (Fetch API)
- **Data Format**: JSON
