import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getErrorMessage } from "../lib/format";

export type LocalAgent = {
  id: string;
  label: string;
  vendor: string;
  available: boolean;
  path?: string | null;
  protocol: string;
  unsupported: boolean;
};

export type AgentInvokeRequest = {
  agent: string;
  prompt: string;
  cwd?: string | null;
  model?: string | null;
  binOverride?: string | null;
  jobId?: string | null;
};

export type AgentInvokeResult = {
  success: boolean;
  text: string;
  html?: string | null;
  exitCode?: number | null;
  stderr: string[];
  meta: Array<{ key: string; value: unknown }>;
};

export type AgentInvokeEvent =
  | {
      type: "start";
      bin: string;
      argv: string[];
      promptBytes: number;
      cwd?: string | null;
    }
  | { type: "delta"; text: string }
  | { type: "html"; text: string }
  | { type: "meta"; key: string; value: unknown }
  | { type: "stderr"; text: string }
  | { type: "raw"; text: string }
  | { type: "canceled" }
  | { type: "done"; code?: number | null }
  | { type: "error"; message: string };

type AgentEventPayload = {
  jobId?: string | null;
  event: AgentInvokeEvent;
};

export function useAgentBridge() {
  const [agents, setAgents] = useState<LocalAgent[]>([]);
  const [events, setEvents] = useState<AgentEventPayload[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = listen<AgentEventPayload>("agent-invoke-event", (event) => {
      setEvents((current) => [...current, event.payload]);
    });
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  const detectAgents = useCallback(async () => {
    setError(null);
    try {
      const result = await invoke<LocalAgent[]>("detect_local_agents");
      setAgents(result);
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  const invokeAgent = useCallback(async (request: AgentInvokeRequest) => {
    setRunning(true);
    setError(null);
    setEvents([]);
    try {
      return await invoke<AgentInvokeResult>("invoke_local_agent", { request });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setRunning(false);
    }
  }, []);

  const cancelAgent = useCallback(async (jobId: string) => {
    setError(null);
    try {
      return await invoke<boolean>("cancel_local_agent", { jobId });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  return {
    agents,
    events,
    running,
    error,
    detectAgents,
    invokeAgent,
    cancelAgent,
  };
}
