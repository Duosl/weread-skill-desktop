/* ==========================================================================
   自动更新 Hook - 检测、下载、安装
   ========================================================================== */

import { useState, useCallback, useRef, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "uptodate"
  | "error";

export type UpdateState = {
  status: UpdateStatus;
  version?: string;
  currentVersion?: string;
  body?: string;
  progress?: number;
  errorTitle?: string;
  error?: string;
};

const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 小时
const STARTUP_DELAY = 3000; // 启动后 3 秒检测

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getUpdaterErrorTitle(error: string) {
  if (/different key|signature.*key|key.*provided/i.test(error)) {
    return "签名密钥不匹配";
  }

  if (/signature/i.test(error)) {
    return "签名校验失败";
  }

  // return "检查失败，请稍后再试";
  return error;
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCheckingRef = useRef(false);
  const isDownloadingRef = useRef(false);
  const pendingUpdateRef = useRef<NonNullable<Awaited<ReturnType<typeof check>>> | null>(null);
  const statusRef = useRef<UpdateStatus>("idle");

  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  const downloadUpdate = useCallback(async () => {
    if (isDownloadingRef.current || statusRef.current === "ready") {
      return;
    }

    let update = pendingUpdateRef.current;
    if (!update) {
      try {
        update = await check();
        pendingUpdateRef.current = update;
      } catch (error) {
        const msg = normalizeError(error);
        setState((prev) => ({
          ...prev,
          status: "error",
          errorTitle: getUpdaterErrorTitle(msg),
          error: msg,
        }));
        return;
      }
    }

    if (!update) {
      setState((prev) => ({ ...prev, status: "uptodate" }));
      return;
    }

    isDownloadingRef.current = true;
    setState((prev) => ({
      ...prev,
      status: "downloading",
      version: update?.version ?? prev.version,
      body: update?.body || prev.body,
      progress: 0,
    }));

    try {
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength || 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              const progress = Math.round((downloaded / contentLength) * 100);
              setState((prev) => ({ ...prev, progress }));
            }
            break;
          case "Finished":
            setState((prev) => ({ ...prev, status: "ready", progress: 100 }));
            break;
        }
      });
    } catch (error) {
      const msg = normalizeError(error);
      setState((prev) => ({
        ...prev,
        status: "error",
        errorTitle: getUpdaterErrorTitle(msg),
        error: msg,
      }));
    } finally {
      isDownloadingRef.current = false;
    }
  }, []);

  const checkForUpdates = useCallback(async (silent = true) => {
    if (isCheckingRef.current || isDownloadingRef.current || statusRef.current === "ready") {
      return;
    }
    isCheckingRef.current = true;

    try {
      setState((prev) => ({ ...prev, status: "checking" }));

      const update = await check();
      pendingUpdateRef.current = update;

      if (update) {
        setState((prev) => ({
          ...prev,
          status: "available",
          version: update.version,
          currentVersion: undefined,
          body: update.body || undefined,
          errorTitle: undefined,
          error: undefined,
        }));

        // 静默下载
        if (silent) {
          await downloadUpdate();
        }
      } else {
        setState((prev) => ({ ...prev, status: "uptodate" }));
      }
    } catch (error) {
      const msg = normalizeError(error);
      console.error(msg);
      const isRemoteEmpty =
        /release\s*json|fetch|404|not\s*found|invalid/i.test(msg);
      if (isRemoteEmpty) {
        setState((prev) => ({ ...prev, status: "uptodate" }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "error",
          errorTitle: getUpdaterErrorTitle(msg),
          error: msg,
        }));
      }
    } finally {
      isCheckingRef.current = false;
    }
  }, [downloadUpdate]);

  const installUpdate = useCallback(async () => {
    try {
      await relaunch();
    } catch (error) {
      const msg = normalizeError(error);
      setState((prev) => ({
        ...prev,
        status: "error",
        errorTitle: getUpdaterErrorTitle(msg),
        error: msg,
      }));
    }
  }, []);

  // 启动时检测 + 定时检测
  useEffect(() => {
    const startupTimer = setTimeout(() => {
      checkForUpdates(true);
    }, STARTUP_DELAY);

    timerRef.current = setInterval(() => {
      checkForUpdates(true);
    }, CHECK_INTERVAL);

    return () => {
      clearTimeout(startupTimer);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [checkForUpdates]);

  return {
    state,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}
