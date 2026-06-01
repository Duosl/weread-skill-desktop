# search — 搜索

## 接口

`/store/search`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | string | 是 | 搜索关键词 |
| `scope` | int | 否 | 搜索类型：0=全部, 10=电子书, 16=网文小说, 14=听书, 6=作者, 12=全文, 13=书单, 2=公众号, 4=文章。默认 10 |
| `maxIdx` | int | 否 | 翻页偏移，默认 0 |
| `count` | int | 否 | 每页数量，不传则服务端默认 15 |

**scope 选择指引：**
- 用户明确说"搜书""找书" → `scope=10`
- 用户只说"搜一下"未限定类型 → `scope=0`
- 用户说"听书""有声书" → `scope=14`
- 用户说"搜作者" → `scope=6`

**回包：**

| 字段 | 说明 |
|------|------|
| `hasMore` | 是否有更多（1=有） |
| `results` | 搜索结果分组数组 |
| `results[].title` | 分组标题 |
| `results[].books` | 书籍数组 |
| `results[].books[].bookInfo.bookId` | 书籍 ID |
| `results[].books[].bookInfo.title` | 书名 |
| `results[].books[].bookInfo.author` | 作者 |
| `results[].books[].newRating` | 评分（0-100） |
| `results[].books[].readingCount` | 在读人数 |

## 工作流

1. 根据用户意图选择 `scope`，调 `/store/search`
2. 从 `results` 取搜索结果，展示书名、作者、评分
3. 用户选择某本书后，调 `/book/info` 获取完整信息
4. 翻页：用最后一条的 `searchIdx` 作为下一页的 `maxIdx`
