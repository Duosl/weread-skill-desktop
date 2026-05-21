use std::env;
use std::path::PathBuf;

/// 获取用户工具链目录列表
pub fn user_toolchain_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(home) = dirs::home_dir() {
        // 通用 Unix 目录
        dirs.push(home.join(".local/bin"));
        dirs.push(home.join(".bun/bin"));
        dirs.push(home.join(".volta/bin"));
        dirs.push(home.join(".asdf/shims"));
        dirs.push(home.join(".cargo/bin"));
        dirs.push(home.join(".npm-global/bin"));
        dirs.push(home.join(".npm-packages/bin"));
        dirs.push(home.join(".claude/local"));
        dirs.push(home.join("Library/pnpm"));

        // Windows 特定目录
        if cfg!(target_os = "windows") {
            if let Ok(scoop) = env::var("SCOOP") {
                let scoop_root = PathBuf::from(scoop);
                dirs.push(scoop_root.join("shims"));
                dirs.push(scoop_root.join("apps/nodejs/current"));
                dirs.push(scoop_root.join("apps/nodejs-lts/current"));
            } else {
                dirs.push(home.join("scoop/shims"));
                dirs.push(home.join("scoop/apps/nodejs/current"));
                dirs.push(home.join("scoop/apps/nodejs-lts/current"));
            }

            if let Ok(global_scoop) = env::var("SCOOP_GLOBAL") {
                let global_root = PathBuf::from(global_scoop);
                dirs.push(global_root.join("shims"));
                dirs.push(global_root.join("apps/nodejs/current"));
            } else {
                dirs.push(PathBuf::from("C:/ProgramData/scoop/shims"));
                dirs.push(PathBuf::from("C:/ProgramData/scoop/apps/nodejs/current"));
            }

            if let Ok(appdata) = env::var("APPDATA") {
                dirs.push(PathBuf::from(appdata).join("npm"));
            }
        } else {
            // macOS / Linux
            dirs.push(PathBuf::from("/opt/homebrew/bin"));
            dirs.push(PathBuf::from("/usr/local/bin"));
        }
    }

    // 从环境变量获取的目录
    if let Ok(vp) = env::var("VP_HOME") {
        let vp = vp.trim();
        if !vp.is_empty() {
            dirs.push(PathBuf::from(vp).join("bin"));
        }
    }

    if let Ok(npm_prefix) = env::var("NPM_CONFIG_PREFIX") {
        let npm_prefix = npm_prefix.trim();
        if !npm_prefix.is_empty() {
            let prefix = PathBuf::from(npm_prefix);
            dirs.push(prefix.join("bin"));
            dirs.push(prefix);
        }
    }

    dirs
}
