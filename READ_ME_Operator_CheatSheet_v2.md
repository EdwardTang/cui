# Serena × Claude Code：落地速查清单（Ubuntu）

> 一张 A4 的操作卡：**安装 → 接入 → 索引 → Onboarding → 高阶指令 → 排错**。

---

## A. 初始化最短路径（Ubuntu）

1) **安装 uv（一次性）**  
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
exec $SHELL  # 让 uv/uvx 生效
uv --version && uvx --version
```

2) **把 Serena 接入 Claude Code（项目根目录执行）**  
> 先确保已安装 Claude Code CLI，并已在终端里可用 `claude`/`claude mcp`。  
```bash
claude mcp add serena -- \
  uvx --from git+https://github.com/oraios/serena \
  serena start-mcp-server --context ide-assistant --project "$(pwd)"
```

3) **（可选，强烈建议）构建大仓索引**  
```bash
uvx --from git+https://github.com/oraios/serena serena project index
```

4) **首次使用 Onboarding（在对话里触发 Serena 的 onboarding 工具）**  
- 目标：识别项目结构、构建/测试方式，写入 `.serena/memories/`。  
- 完成后建议**换新线程**继续编码（避免上下文拥挤）。

5) **Windows Git（如在 Win 环境）建议**  
```bash
git config --global core.autocrlf true
```

> 说明：新版本的 Claude Code 会自动读取 MCP 指令；若没有，你可在对话中让它执行 `/mcp__serena__initial_instructions`（需在 Serena 配里开启该可选工具）。

---

## B. 高阶用法（可直接复制给 Claude 的“指令模板”）

### 1) 规划与记忆
**制定一次性计划并落盘**  
> 只用符号检索，不读函数体。保存为 `PLAN_[任务名]_[今天日期]`。  
```
请切换到 planning + one-shot，生成“目标→子任务→接口变更→验证方式”的计划。
然后使用 write_memory 保存为：PLAN_[任务名]_[今天日期]。仅使用符号检索，不要读取函数体。
```

**续作前读取记忆**  
```
先 list_memories，再 read_memory 加载最新的 PLAN_* 或 STATE_*，然后给出续作建议。
```

### 2) 符号优先的定位
```
请仅使用 find_symbol / get_symbols_overview / find_referencing_symbols 定位受影响的类型与函数，
除非必要，不要 read_file 函数体。先给我“符号关系清单”，再决定改哪里。
```

### 3) 安全小步编辑
```
本轮只修改【具体符号】的实现。先给出“前后对比摘要 + 预期影响”。
编辑时优先 replace_symbol_body 或 insert_before/after_symbol。若无符号锚点再考虑行级插入。
完成后展示受影响文件列表与 diff 要点。
```

### 4) 执行验证（需确认）
```
准备运行最小验证集（lint/单测/样例运行）。请列出将执行的命令及预期通过准则，等待我确认再执行。
```

### 5) 大仓节流
```
在整个会话中，除非我明确允许，请不要读取函数体。需要读时请先解释原因并征求同意。
```

### 6) 长任务切片与续作
```
在结束当前子任务前，使用 think_about_whether_you_are_done 复盘；
若未完成，用 write_memory 保存 STATE_[任务名]_[序号]；
并用 prepare_for_new_conversation 生成续作提要。
```

### 7) 模式切换
```
请用 switch_modes 切换到 editing + interactive，执行上述计划中“当前子任务”的实现。
```

### 8) 索引/语言服复位
```
如工具响应异常，请先 restart_language_server；如检索缓慢，请建议是否重建索引并执行 project index。
```

---

## C. 项目级配置片段（可选）

**只读模式（评审/审计时很有用）**
```yaml
# .serena/project.yml
read_only: true
```

**禁用某些工具（更严格）**
```yaml
# .serena/project.yml
disabled_tools:
  - execute_shell_command
```

**记录工具使用与打开 Dashboard**
```yaml
# ~/.serena/serena_config.yml
record_tool_usage_stats: true
open_dashboard_on_start: true
```

---

## D. 常见故障与小窍门

- **MCP 僵尸进程**：启用 Dashboard，可一键关闭；或用 `ps`/系统监视器结束 Python 子进程。  
- **路径问题**：尽量用**绝对路径**；Windows 路径注意**反斜杠转义**。  
- **指令丢失**：新会话或对话被压缩后，**让 Claude 重新加载“初始指令/记忆”**。  
- **编辑混乱**：强制采用“**一改一验**”节奏；每次只动一个符号/职责，回看 diff，再进下一步。  
- **索引变慢**：大仓变更较多时，建议 `serena project index` 重新构建。

---

## E. 你可能会用到的“一句话检查”

```bash
# Serena CLI 是否可用？
uvx --from git+https://github.com/oraios/serena serena --help

# Serena MCP 是否已接入 Claude？
claude mcp list | grep serena

# 重建索引（在仓库根目录）
uvx --from git+https://github.com/oraios/serena serena project index

# （可选）清理缓存/重启语言服务（按你本地集成而定）
# restart_language_server 由 IDE/Serena 集成提供
```
