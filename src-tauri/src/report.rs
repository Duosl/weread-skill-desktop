use std::fs;
use std::path::{Path, PathBuf};

const REPORT_PRIVATE_DIR: &str = ".weread-desktop";
const REPORT_PREVIEW_DIR: &str = "reports/preview";

pub fn export_report_html(output_dir: &str, title: &str, html: &str) -> Result<String, String> {
    if output_dir.trim().is_empty() {
        return Err("请选择导出目录".to_string());
    }
    if html.trim().is_empty() {
        return Err("报告内容为空，无法导出".to_string());
    }

    let output_dir = resolve_output_dir(output_dir).join("reports");
    fs::create_dir_all(&output_dir).map_err(|e| format!("创建报告目录失败: {e}"))?;

    let file_path = unique_html_path(&output_dir, title);
    fs::write(&file_path, html).map_err(|e| format!("写入报告失败: {e}"))?;
    if !file_path.exists() {
        return Err("写入验证失败，报告未生成".to_string());
    }
    Ok(file_path.to_string_lossy().to_string())
}

pub fn preview_report_html(title: &str, html: &str) -> Result<String, String> {
    if html.trim().is_empty() {
        return Err("报告内容为空，无法预览".to_string());
    }

    let preview_dir = private_report_dir();
    fs::create_dir_all(&preview_dir).map_err(|e| format!("创建报告预览目录失败: {e}"))?;

    let file_path = preview_dir.join(format!("{}.html", safe_file_name(title)));
    fs::write(&file_path, html).map_err(|e| format!("写入报告预览失败: {e}"))?;
    if !file_path.exists() {
        return Err("写入验证失败，报告预览未生成".to_string());
    }
    Ok(file_path.to_string_lossy().to_string())
}

fn private_report_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(REPORT_PRIVATE_DIR)
        .join(REPORT_PREVIEW_DIR)
}

fn resolve_output_dir(path: &str) -> PathBuf {
    if path == "~" || path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return if path == "~" {
                home
            } else {
                home.join(path.trim_start_matches("~/"))
            };
        }
    }
    Path::new(path).to_path_buf()
}

fn unique_html_path(output_dir: &Path, title: &str) -> PathBuf {
    let base = safe_file_name(title);
    let mut candidate = output_dir.join(format!("{base}.html"));
    if !candidate.exists() {
        return candidate;
    }

    for index in 2..1000 {
        candidate = output_dir.join(format!("{base}-{index}.html"));
        if !candidate.exists() {
            return candidate;
        }
    }

    output_dir.join(format!("{base}-report.html"))
}

fn safe_file_name(title: &str) -> String {
    let cleaned = title
        .chars()
        .map(|ch| {
            if ch.is_control() {
                '_'
            } else if ch.is_alphanumeric() || ch == '-' || ch == '_' || ch == ' ' {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>();
    let collapsed = cleaned
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .trim_matches('_')
        .to_string();
    let source = if collapsed.is_empty() {
        "阅读报告".to_string()
    } else {
        collapsed
    };
    source.chars().take(80).collect()
}
