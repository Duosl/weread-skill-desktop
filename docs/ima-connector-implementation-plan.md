# 腾讯 ima 连接器实现方案

> 需求来源：`REQ-010 腾讯 ima 联动`
>
> 当前实现方向：在左侧菜单新增 `连接器` 页面。第一版支持 ima：配置凭证、测试连接、列出可添加的 ima 知识库，并为后续把微信读书笔记导入指定知识库做准备。

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
8. 后续导入微信读书笔记时，优先使用用户已经缓存的微信读书接口数据；缓存缺失或过期时再提示刷新或补拉。

ima skill 当前支持搜索、浏览和列出可添加知识库，但未提供“新建知识库”接口。因此 UI 只提供选择知识库，并提示用户如果列表为空，需要先在 ima 客户端或 ima 网页中手动创建知识库。

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
- 可保存一个默认知识库目标。
- 展示“ima 不支持在本应用中新建知识库”的说明。
- 文档明确后续导入要优先使用本地 API 缓存数据。

### 暂不做什么

- 不新建 ima 知识库。
- 不做完整 ima 知识库浏览器。
- 不做后台自动同步。
- 不直接追加到已有 ima 笔记。
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
```

### ima API

测试连接和列出知识库使用：

```text
POST https://ima.qq.com/openapi/wiki/v1/get_addable_knowledge_base_list
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
  "cursor": "",
  "limit": 50
}
```

第一版不调用 `create_media` / COS / `add_knowledge`，除非进入真正导入实现阶段。

---

## 4. 导入数据策略

后续导入微信读书笔记到 ima 知识库时，优先使用用户已缓存的接口数据：

- `notebooks_with_cache(..., force_refresh=false)`
- `bookmark_list_with_cache(..., force_refresh=false)`
- `my_reviews_with_cache(..., force_refresh=false)`
- `book_info` / `book_progress` 可继续走现有缓存策略或按需补齐。

如果缓存不存在或超过用户设置的缓存有效期，后端可以正常补拉微信读书接口；前端文案应说明“会优先使用本地缓存，缺少数据时再读取微信读书接口”。如果用户希望完全不联网导入，应作为后续独立选项，而不是第一版默认行为。

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

---

## 6. 后续导入实现

真正导入阶段建议走 Markdown 文件上传：

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
