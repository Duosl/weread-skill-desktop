# 腾讯 ima 连接器实现方案

> 需求来源：`REQ-010 腾讯 ima 联动`
>
> 当前实现方向：在左侧菜单新增 `连接器` 页面。第一版支持 ima：配置凭证、测试连接、列出可添加的 ima 知识库，并把微信读书 Markdown 笔记同步到指定知识库。

---

## 1. 结论

第一版采用独立连接器页，而不是把 ima 配置放进设置页，也不把 ima 同步混进普通 Markdown 导出成功路径。

用户流程：

1. 左侧菜单进入 `连接器`。
2. 页面展示 `ima` 连接器卡片。
3. 点击 `配置` 打开弹窗。
4. 用户填写 ima `Client ID` 和 `API Key`。
5. 点击 `测试连接`。
6. 连接成功后，列出所有可添加的 ima 知识库。
7. 用户选择一个知识库作为默认导入目标。
8. 用户从连接器卡片点击「去同步」，进入笔记工作台的导出区。
9. 用户复用导出区的选书、包含划线、包含想法等选项，点击「同步到 ima」。
10. 应用把所选书生成 Markdown 笔记，创建到 ima 笔记，并加入所选知识库。

ima skill 当前支持搜索、浏览和列出可添加知识库，但未提供“新建知识库”接口。因此 UI 只提供选择知识库，并提示用户如果列表为空，需要先在 ima 客户端或 ima 网页中手动创建知识库。

知识库列表采用缓存优先策略：打开配置弹窗时优先读取 24 小时内缓存；用户点击「刷新知识库」时强制请求 ima 接口并更新缓存。缓存按 Client ID 指纹隔离，不在缓存 key 或日志中写入完整凭证。

缓存状态属于实现细节，不在 UI 中展示“来自缓存”或“来自接口”的标签。用户只看到读取、刷新、同步和结果。

---

## 2. 第一版范围

### 做什么

- 左侧菜单新增 `连接器`。
- 新增 `ConnectorsPage`。
- 支持 ima 连接器卡片。
- ima 配置以弹窗形式展开。
- 保存 ima `Client ID` / `API Key`。
- 清除 ima 凭证。
- 测试 ima 连接。
- 连接成功后列出可添加的 ima 知识库。
- 打开配置弹窗时自动加载知识库列表，优先使用 24 小时内缓存。
- 「刷新知识库」按钮放在知识库标题行右侧，点击时强制请求 ima 接口并更新缓存。
- 可保存一个默认知识库目标。
- 展示“ima 不支持在本应用中新建知识库”的说明。
- 连接器卡片提供「去同步」快捷入口，跳转到笔记工作台的导出区。
- 导出区支持把所选微信读书笔记同步到所选 ima 知识库。
- 同步时优先复用已有同名 ima 笔记并重新加入知识库；没有同名笔记时创建新的 ima 笔记，再加入知识库。不追加、不覆盖已有笔记内容。

### 暂不做什么

- 不新建 ima 知识库。
- 不做完整 ima 知识库浏览器。
- 不做后台自动同步。
- 不在连接器配置弹窗内嵌完整选书和同步工作台。
- 不直接追加到已有 ima 笔记。
- 不展示缓存命中状态，避免把内部实现暴露给普通用户。
- 不在第一步强行接入 PDF；PDF 等 `REQ-009` 明确后再接。
- 不把导入失败伪装成本地导出成功。

---

## 3. 后端设计

### 配置字段

`AppConfig` 新增：

```rust
pub ima_client_id: Option<String>,
pub ima_api_key: Option<String>,
pub ima_knowledge_base_id: Option<String>,
pub ima_knowledge_base_name: Option<String>,
```

`AppSettings` 新增脱敏状态：

```rust
pub ima_client_id_set: bool,
pub ima_client_id_masked: Option<String>,
pub ima_client_id_full: Option<String>,
pub ima_api_key_set: bool,
pub ima_api_key_masked: Option<String>,
pub ima_api_key_full: Option<String>,
pub ima_knowledge_base_id: Option<String>,
pub ima_knowledge_base_name: Option<String>,
```

第一版沿用当前微信读书 Token 的编辑方式，前端可回显完整值并使用密码输入隐藏。后续如果接入系统 keychain，再改为只保存/清除、不回显。

### Tauri 命令

```rust
save_ima_credentials(client_id: String, api_key: String) -> Result<AppSettings, String>
clear_ima_credentials() -> Result<AppSettings, String>
test_ima_connection() -> Result<ImaConnectionTestResult, String>
list_addable_ima_knowledge_bases(cursor: Option<String>, limit: Option<u32>) -> Result<ImaKnowledgeBasePage, String>
save_ima_target(knowledge_base_id: String, knowledge_base_name: String) -> Result<AppSettings, String>
sync_books_to_ima(options: ImaSyncOptions) -> Result<ImaSyncResult, String>
```

### ima API

测试连接使用实时请求；列出知识库使用缓存优先，手动刷新时强制实时请求。接口使用：

```text
POST https://ima.qq.com/openapi/wiki/v1/search_knowledge_base
```

Header：

```text
ima-openapi-clientid: <Client ID>
ima-openapi-apikey: <API Key>
Content-Type: application/json
```

请求：

```json
{
  "query": "",
  "cursor": "",
  "limit": 20
}
```

只展示用户自己创建的个人知识库；共享知识库不出现在选择列表中。当前通过返回字段 `role_type=创建者` 且 `base_type=个人知识库` 过滤。

缓存规则：

- 缓存有效期固定为 24 小时。
- 自动加载知识库时读取缓存；缓存缺失或过期再请求 ima。
- 点击「刷新知识库」时跳过缓存，成功后写入新缓存。
- 缓存按 Client ID 指纹隔离，避免切换 ima 账号后混用列表。

当前 Markdown 同步不走 COS 文件上传，而是调用 ima 笔记接口 `import_doc` 创建 Markdown 笔记，再调用知识库 `add_knowledge`，使用 `media_type=11` 把笔记加入知识库。

---

## 4. 导入数据策略

同步微信读书笔记到 ima 知识库时复用导出区的选择逻辑，并优先使用用户已缓存的接口数据：

- `notebooks_with_cache(..., force_refresh=false)`
- `bookmark_list_with_cache(..., force_refresh=false)`
- `my_reviews_with_cache(..., force_refresh=false)`
- `book_info` / `book_progress` 可继续走现有缓存策略或按需补齐。

如果缓存不存在或超过用户设置的缓存有效期，后端可以正常补拉微信读书接口。UI 不展示缓存命中状态，只说明同步会读取划线原文和个人想法。如果用户希望完全不联网导入，应作为后续独立选项，而不是第一版默认行为。

当前同步策略：

1. 使用导出区已选书籍；如果后端收到空列表，则读取所有有划线或想法的笔记本书籍。
2. 复用现有 Markdown 构建逻辑，包含 Frontmatter、划线、想法和章节分组。
3. 使用书名作为 ima 笔记标题，并确保同步正文第一行是 `# 书名`，避免 ima 将 Frontmatter 中的书籍编号识别为标题。
4. 已存在同名笔记时复用该笔记，并调用 `openapi/wiki/v1/add_knowledge` 重新加入目标知识库。
5. 不存在同名笔记时调用 `openapi/note/v1/import_doc` 创建 Markdown 笔记。
6. 调用 `openapi/wiki/v1/add_knowledge`，以 `media_type=11` 将笔记加入目标知识库。
7. 批量同步允许部分成功，逐项展示完成、跳过和失败原因。

---

## 5. UI 文案

连接器页标题：

```text
连接器
```

页面说明：

```text
把本地阅读档案连接到外部知识库。当前支持 ima，后续会继续扩展更多目标。
```

ima 卡片：

```text
ima 知识库
把微信读书划线和个人想法导入到你选择的 ima 知识库。
```

知识库空列表提示：

```text
没有找到可添加的知识库。ima 暂不支持在本应用中新建知识库，请先在 ima 中手动创建一个知识库，再回到这里测试连接。
```

隐私说明：

```text
导入时会读取所选书籍的划线原文和个人想法，并上传到你选择的 ima 知识库。ima 凭证只用于请求 ima 官方接口。
```

同步说明：

```text
同步会读取划线原文和个人想法，在 ima 中创建或复用同名笔记并加入知识库，不覆盖已有内容。
```

---

## 6. 后续文件上传实现

如果后续要把 Markdown 作为文件上传到知识库，而不是创建 ima 笔记，应走文件上传链路：

1. 使用缓存优先策略读取微信读书数据。
2. 复用现有 Markdown 构建逻辑，生成临时 `.md` 文件。
3. `check_repeated_names` 检查重名。
4. `create_media` 获取 COS 临时凭证。
5. 上传到 COS。
6. `add_knowledge` 添加到知识库。

关键规则：

- Markdown `media_type=7`。
- `title` 必须等于 `file_name`，带 `.md` 扩展名。
- 根目录不传 `folder_id`。
- COS 上传失败后不能调用 `add_knowledge`。
- 批量导入允许部分成功，并逐项展示结果。
