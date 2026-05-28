#!/usr/bin/env bash

set -euo pipefail

fail() {
  printf '\n错误：%s\n' "$1" >&2
  exit 1
}

run() {
  printf '\n$ %q' "$1"
  for arg in "${@:2}"; do
    printf ' %q' "$arg"
  done
  printf '\n'
  "$@"
}

raw_version="${1:-}"
if [[ -z "$raw_version" ]]; then
  fail "缺少版本号。用法：./scripts/release-tag.sh v0.4.3"
fi

if [[ "$raw_version" == v* ]]; then
  tag="$raw_version"
else
  tag="v${raw_version}"
fi

if [[ ! "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
  fail "版本号 \"${raw_version}\" 不合法。请使用 v0.4.3 或 0.4.3 这类格式。"
fi

[[ -f CHANGELOG.md ]] || fail "未找到 CHANGELOG.md。"

notes="$(
  VERSION_TAG="$tag" python3 - <<'PY'
import os
import re
from pathlib import Path

tag = os.environ["VERSION_TAG"]
changelog = Path("CHANGELOG.md").read_text(encoding="utf-8").replace("\r\n", "\n")
escaped_tag = re.escape(tag)
heading_pattern = re.compile(
    rf"^##\s+\[{escaped_tag}\]\s*(?:-.*)?$|^##\s+{escaped_tag}\s*(?:-.*)?$",
    re.MULTILINE,
)
heading = heading_pattern.search(changelog)
if not heading:
    raise SystemExit(2)

section_rest = changelog[heading.end():]
next_heading = re.search(r"^##\s+", section_rest, re.MULTILINE)
section = section_rest[: next_heading.start() if next_heading else None].strip()
if not section:
    raise SystemExit(3)

print(section)
PY
)" || case "$?" in
  2) fail "CHANGELOG.md 中没有找到 ${tag} 对应的版本标题。" ;;
  3) fail "CHANGELOG.md 中包含 ${tag}，但该版本的更新日志内容为空。" ;;
  *) fail "解析 CHANGELOG.md 失败。" ;;
esac

printf '已找到 %s 对应的 CHANGELOG.md 更新日志。\n' "$tag"

branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "main" ]] || fail "当前分支是 ${branch}，请切换到 main 后再发布。"

if [[ -n "$(git status --porcelain)" ]]; then
  fail "当前工作区不干净。请先提交或暂存改动，再创建发布标签。"
fi

if [[ -n "$(git tag --list "$tag")" ]]; then
  fail "本地已存在标签 ${tag}。"
fi

if [[ -n "$(git ls-remote --tags origin "refs/tags/${tag}")" ]]; then
  fail "远端 origin 已存在标签 ${tag}。"
fi

run git pull origin main
run git push origin main
run git tag "$tag"
run git push origin "$tag"

printf '\n发布标签 %s 已推送。\n' "$tag"
