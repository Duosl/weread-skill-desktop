use std::env;
use std::path::PathBuf;

use super::toolchain::user_toolchain_dirs;

/// 在 PATH 和工具链目录中查找二进制文件
pub fn resolve_on_path(bin: &str) -> Option<String> {
    let exts = if cfg!(target_os = "windows") {
        vec![
            ".exe".to_string(),
            ".cmd".to_string(),
            ".bat".to_string(),
            ".com".to_string(),
        ]
    } else {
        vec![String::new()]
    };

    let mut seen = std::collections::HashSet::new();
    let mut dirs: Vec<PathBuf> = Vec::new();

    // 从 PATH 环境变量获取目录
    if let Ok(path_env) = env::var("PATH") {
        for dir in path_env.split(':') {
            let path = PathBuf::from(dir);
            if seen.insert(path.clone()) {
                dirs.push(path);
            }
        }
    }

    // 添加工具链目录
    for dir in user_toolchain_dirs() {
        if seen.insert(dir.clone()) {
            dirs.push(dir);
        }
    }

    // 搜索二进制文件
    for dir in &dirs {
        for ext in &exts {
            let full_path = dir.join(format!("{}{}", bin, ext));
            if full_path.exists() {
                return Some(full_path.to_string_lossy().to_string());
            }
        }
    }

    None
}
