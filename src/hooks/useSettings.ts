import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "@/types";
import { getErrorMessage } from "@/lib/format";

const fallbackSettings: AppSettings = {
  apiKeySet: false,
  apiKeyMasked: null,
  apiKeyFull: null,
  lastExportDir: "~/Documents/WereadNotes",
  defaultFormat: "markdown",
  cacheTtlSeconds: 24 * 60 * 60,
  imaClientIdSet: false,
  imaClientIdMasked: null,
  imaClientIdFull: null,
  imaApiKeySet: false,
  imaApiKeyMasked: null,
  imaApiKeyFull: null,
  imaKnowledgeBaseId: null,
  imaKnowledgeBaseName: null,
  telemetryEnabled: true,
  telemetryInstallationId: null,
  telemetryEndpointConfigured: false,
  llmConfigured: false,
  llmBaseUrl: null,
  llmModel: null,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(fallbackSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings(await invoke<AppSettings>("get_settings"));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveApiKey = async (apiKey: string) => {
    setSettings(await invoke<AppSettings>("save_api_key", { apiKey }));
  };

  const clearApiKey = async () => {
    setSettings(await invoke<AppSettings>("clear_api_key"));
  };

  const saveExportSettings = async (outputDir: string, defaultFormat: string) => {
    setSettings(
      await invoke<AppSettings>("save_export_settings", {
        outputDir,
        defaultFormat,
      }),
    );
  };

  const saveCacheSettings = async (cacheTtlSeconds: number) => {
    setSettings(
      await invoke<AppSettings>("save_cache_settings", {
        cacheTtlSeconds,
      }),
    );
  };

  const saveTelemetryEnabled = async (enabled: boolean) => {
    setSettings(await invoke<AppSettings>("save_telemetry_enabled", { enabled }));
  };

  const resetTelemetryInstallationId = async () => {
    setSettings(await invoke<AppSettings>("reset_telemetry_installation_id"));
  };

  const saveImaCredentials = async (clientId: string, apiKey: string) => {
    setSettings(
      await invoke<AppSettings>("save_ima_credentials", {
        clientId,
        apiKey,
      }),
    );
  };

  const clearImaCredentials = async () => {
    setSettings(await invoke<AppSettings>("clear_ima_credentials"));
  };

  const saveImaTarget = async (
    knowledgeBaseId: string,
    knowledgeBaseName: string,
  ) => {
    setSettings(
      await invoke<AppSettings>("save_ima_target", {
        knowledgeBaseId,
        knowledgeBaseName,
      }),
    );
  };

  const saveLlmConfig = async (baseUrl: string, apiKey: string, model: string) => {
    setSettings(
      await invoke<AppSettings>("save_llm_config", {
        baseUrl,
        apiKey,
        model,
      }),
    );
  };

  const clearLlmConfig = async () => {
    setSettings(await invoke<AppSettings>("clear_llm_config"));
  };

  return {
    settings,
    loading,
    error,
    refresh,
    saveApiKey,
    clearApiKey,
    saveExportSettings,
    saveCacheSettings,
    saveTelemetryEnabled,
    resetTelemetryInstallationId,
    saveImaCredentials,
    clearImaCredentials,
    saveImaTarget,
    saveLlmConfig,
    clearLlmConfig,
  };
}
