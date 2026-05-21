use agent_cli_bridge::{invoke_agent, InvokeOpts};
use std::path::PathBuf;

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: invoke <agent> <prompt> [--model <model>] [--cwd <dir>]");
        std::process::exit(1);
    }

    let agent = &args[1];
    let prompt = &args[2];
    let mut model = None;
    let mut cwd = None;

    let mut i = 3;
    while i < args.len() {
        match args[i].as_str() {
            "--model" => {
                if i + 1 < args.len() {
                    model = Some(args[i + 1].clone());
                    i += 2;
                } else {
                    eprintln!("--model requires a value");
                    std::process::exit(1);
                }
            }
            "--cwd" => {
                if i + 1 < args.len() {
                    cwd = Some(PathBuf::from(&args[i + 1]));
                    i += 2;
                } else {
                    eprintln!("--cwd requires a value");
                    std::process::exit(1);
                }
            }
            _ => {
                eprintln!("Unknown argument: {}", args[i]);
                std::process::exit(1);
            }
        }
    }

    println!("Invoking {} with prompt...\n", agent);

    let opts = InvokeOpts {
        agent: agent.clone(),
        prompt: prompt.clone(),
        cwd,
        model,
        bin_override: None,
    };

    match invoke_agent(opts).await {
        Ok(mut rx) => {
            while let Some(event) = rx.recv().await {
                match event {
                    agent_cli_bridge::InvokeEvent::Start {
                        bin,
                        argv,
                        prompt_bytes,
                        cwd,
                    } => {
                        println!(
                            "→ Starting: {} {} [prompt: {} bytes, cwd: {:?}]",
                            bin,
                            argv.join(" "),
                            prompt_bytes,
                            cwd
                        );
                    }
                    agent_cli_bridge::InvokeEvent::Delta { text } => {
                        print!("{}", text);
                    }
                    agent_cli_bridge::InvokeEvent::Html { text } => {
                        println!("\n[HTML output received: {} bytes]", text.len());
                    }
                    agent_cli_bridge::InvokeEvent::Meta { key, value } => {
                        println!("\n[Meta: {} = {}]", key, value);
                    }
                    agent_cli_bridge::InvokeEvent::Stderr { text } => {
                        eprint!("{}", text);
                    }
                    agent_cli_bridge::InvokeEvent::Raw { text } => {
                        println!("\n[Raw stdout: {}]", text);
                    }
                    agent_cli_bridge::InvokeEvent::Canceled => {
                        println!("\n→ Canceled");
                    }
                    agent_cli_bridge::InvokeEvent::Done { code } => {
                        println!("\n→ Done with exit code: {:?}", code);
                    }
                    agent_cli_bridge::InvokeEvent::Error { message } => {
                        eprintln!("\n→ Error: {}", message);
                        std::process::exit(1);
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    }
}
