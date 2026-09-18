export interface NoteMetadata {
  id: string;
  filename: string;
  title: string;
  content: string;
  updated_at: number;
  created_at: number;
  character_count: number;
  is_pinned: boolean;
}

export interface AppSettings {
  accent_color: string;
  custom_notes_dir: string | null;
  font_size: string;
  font_family: string;
  line_height: string;
  auto_save_interval: number;
  always_on_top: boolean;
  startup_behavior?: "last" | "new" | "specific";
  startup_specific_note_id?: string | null;
  last_active_note_id?: string | null;
  quick_switcher_mode?: "overlay" | "instant" | "disabled";
  quick_switcher_order?: "mru" | "pinned_updated";
  quick_switcher_shortcut?: "ctrl_tab" | "alt_tab" | "ctrl_pagedown";
  window_width?: number;
  window_height?: number;
  window_x?: number;
  window_y?: number;
  has_completed_onboarding?: boolean;
  discovery_source?: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  accent_color: "#0399F7",
  custom_notes_dir: null,
  font_size: "15px",
  font_family: "system-ui",
  line_height: "1.6",
  auto_save_interval: 500,
  always_on_top: false,
  quick_switcher_mode: "overlay",
  quick_switcher_order: "mru",
  quick_switcher_shortcut: "ctrl_tab",
};

export interface ColorPreset {
  name: string;
  hex: string;
  gradient: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    name: "Raycast Electric Blue",
    hex: "#0399F7",
    gradient: "linear-gradient(135deg, #0399F7 0%, #0066FF 100%)",
  },
  {
    name: "Cyber Cyan",
    hex: "#06B6D4",
    gradient: "linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)",
  },
  {
    name: "Vibrant Violet",
    hex: "#8B5CF6",
    gradient: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
  },
  {
    name: "Emerald Green",
    hex: "#10B981",
    gradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  },
  {
    name: "Sunset Amber",
    hex: "#F59E0B",
    gradient: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
  },
  {
    name: "Neon Rose",
    hex: "#F43F5E",
    gradient: "linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)",
  },
];
