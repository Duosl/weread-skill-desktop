use agent_cli_bridge::detect_agents;

fn main() {
    println!("=== Detecting installed AI agent CLIs ===\n");

    let agents = detect_agents();

    let mut found = Vec::new();
    let mut missing = Vec::new();

    for agent in &agents {
        if agent.available {
            found.push(agent);
        } else {
            missing.push(agent);
        }
    }

    println!("Found {} agents:", found.len());
    for agent in &found {
        println!(
            "  ✓ {} ({}) - {}",
            agent.label,
            agent.id,
            agent.path.as_deref().unwrap_or("unknown")
        );
    }

    if !missing.is_empty() {
        println!("\nMissing {} agents:", missing.len());
        for agent in &missing {
            println!("  ✗ {} ({})", agent.label, agent.id);
        }
    }

    println!("\nTotal: {} agents checked", agents.len());
}
