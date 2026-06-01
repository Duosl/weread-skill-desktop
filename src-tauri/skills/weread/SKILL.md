---
name: shuji-weread
description: 书迹内置微信读书数据能力声明。Skill 文档定义接口语义、参数、返回值和工作流；实际数据获取通过应用内统一数据网关执行。
version: 1.0.0
---

# 书迹 WeRead Skill

所有数据获取都必须通过统一数据网关，不得直接拼请求或绕过网关。需要读取数据时，调用 `invoke_data_gateway`。

## 统一入口

工具名：`invoke_data_gateway`

这是统一数据网关入口，不是某个 Skill 的专属调用器。Skill 文档只负责说明接口语义，网关负责校验、授权和执行。

参数：

```json
{
  "api_name": "/store/search",
  "keyword": "三体",
  "scope": 10
}
```

业务参数必须平铺在同一层，不要包在 `params`、`data` 或 `body` 里。

## 支持能力

| 能力 | 说明 | 用户示例 | 详细说明 |
|------|------|----------|----------|
| 搜索书籍 | 搜索书籍、作者、文章等 | "帮我搜一下三体" | `search.md` |
| 书籍信息 | 详情、目录、阅读进度 | "我读到哪了" | `book.md` |
| 书架 | 查看书架 | "看看我的书架" | `shelf.md` |
| 阅读统计 | 阅读时长、天数、偏好 | "今年读了多久" | `readdata.md` |
| 笔记划线 | 笔记概览、划线和想法 | "看看我在三体里的笔记" | `notes.md` |
| 公开书评 | 摘要公开点评 | "这本书大家怎么评价" | `review.md` |
| 推荐 | 个性化推荐、相似推荐 | "给我推荐几本书" | `discover.md` |

## 通用规则

1. **参数平铺**：业务参数必须和 `api_name` 放在同一层；不要包在 `params`、`data`、`body` 等对象里。
2. **能力文档预检**：调用任何接口前，必须先根据「支持能力」表阅读对应说明文件，确认接口参数、字段含义、单位、计数口径和工作流；禁止仅凭字段名或经验猜测含义。
3. **字段解释优先级**：解释接口回包时，以对应说明文件中的字段说明为准；如果回包字段名和直觉含义冲突，必须服从说明文件。
4. **bookId 解析**：用户输入书名时，先调 `/store/search` 获取 bookId，再执行后续操作。
5. **书架数量**：使用 `/shelf/sync` 回答"书架有多少本书"时，必须按 `books.length + albums.length + (mp 非空 ? 1 : 0)` 计算。
6. **upgrade_info 处理**：如果回包中包含 `upgrade_info`，说明接口版本有更新；展示更新提示信息给用户，但继续正常使用当前回包数据。
7. **结果展示**：列表用编号展示方便选择；搜索结果重点展示书名、作者、评分。
8. **上下文衔接**：对话中记住已查询的 bookId，后续操作无需用户重复提供。
9. **深度链接**：在展示划线、想法、章节等内容时，拼接对应的跳转链接方便用户直接在 App 中打开。
10. **数据展示规范**：
    - **时间戳**：所有 Unix 时间戳字段，展示时须转为 YYYY-MM-DD 格式
    - **阅读时长**：单位为秒，展示时转为"X小时Y分钟"格式

## 深度链接

### 打开书籍

```
weread://reading?bId={bookId}
```

### 跳转到指定章节

```
weread://reading?bId={bookId}&chapterUid={chapterUid}
```

### 跳转到划线/想法位置

```
weread://bestbookmark?bookId={bookId}&chapterUid={chapterUid}&rangeStart={rangeStart}&rangeEnd={rangeEnd}&userVid={userVid}
```

range 解析：`range` 格式为 `"起始-结束"`（如 `"900-2004"`），拆分后分别填入 rangeStart 和 rangeEnd。
