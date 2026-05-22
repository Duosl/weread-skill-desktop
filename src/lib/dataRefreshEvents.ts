export const WEREAD_DATA_REFRESHED_EVENT = "weread:data-refreshed";

export function notifyWereadDataRefreshed() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WEREAD_DATA_REFRESHED_EVENT));
}
