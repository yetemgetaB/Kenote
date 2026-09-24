export const MIN_GLOBAL_ZOOM = 70;
export const MAX_GLOBAL_ZOOM = 150;
export const DEFAULT_GLOBAL_ZOOM = 100;
export const STEP_GLOBAL_ZOOM = 10;

export const MIN_EDITOR_ZOOM = 70;
export const MAX_EDITOR_ZOOM = 200;
export const DEFAULT_EDITOR_ZOOM = 100;
export const STEP_EDITOR_ZOOM = 10;

export function clampGlobalZoom(zoom: number | undefined | null): number {
  if (typeof zoom !== "number" || isNaN(zoom)) return DEFAULT_GLOBAL_ZOOM;
  return Math.min(MAX_GLOBAL_ZOOM, Math.max(MIN_GLOBAL_ZOOM, Math.round(zoom)));
}

export function clampEditorZoom(zoom: number | undefined | null): number {
  if (typeof zoom !== "number" || isNaN(zoom)) return DEFAULT_EDITOR_ZOOM;
  return Math.min(MAX_EDITOR_ZOOM, Math.max(MIN_EDITOR_ZOOM, Math.round(zoom)));
}

export function incrementGlobalZoom(current: number): number {
  const currentClamped = clampGlobalZoom(current);
  return clampGlobalZoom(currentClamped + STEP_GLOBAL_ZOOM);
}

export function decrementGlobalZoom(current: number): number {
  const currentClamped = clampGlobalZoom(current);
  return clampGlobalZoom(currentClamped - STEP_GLOBAL_ZOOM);
}

export function incrementEditorZoom(current: number): number {
  const currentClamped = clampEditorZoom(current);
  return clampEditorZoom(currentClamped + STEP_EDITOR_ZOOM);
}

export function decrementEditorZoom(current: number): number {
  const currentClamped = clampEditorZoom(current);
  return clampEditorZoom(currentClamped - STEP_EDITOR_ZOOM);
}

export function applyGlobalZoom(zoom: number): void {
  const clamped = clampGlobalZoom(zoom);
  if (typeof document !== "undefined" && document.documentElement) {
    (document.documentElement.style as any).zoom = `${clamped / 100}`;
    document.documentElement.style.setProperty("--kenote-global-zoom", `${clamped / 100}`);
  }
}
