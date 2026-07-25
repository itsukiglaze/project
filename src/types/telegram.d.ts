export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface TelegramBackButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}

export interface TelegramMainButton {
  isVisible: boolean;
  text: string;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
  setText: (text: string) => void;
}

export interface TelegramHapticFeedback {
  impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
}

export interface TelegramSafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: Record<string, unknown>;
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;
  BackButton: TelegramBackButton;
  MainButton: TelegramMainButton;
  HapticFeedback: TelegramHapticFeedback;
  ready: () => void;
  expand: () => void;
  close: () => void;
  onEvent: (eventType: string, cb: () => void) => void;
  offEvent: (eventType: string, cb: () => void) => void;
  /**
   * Official feature-detection helper (Bot API 6.1+): "is the CLIENT's
   * WebApp implementation at least this version" — the one Telegram-
   * sanctioned way to gate a newer API method, preferred over manually
   * comparing `.version` strings. Itself optional: absent entirely on
   * ancient/partial WebApp implementations, so every call site must still
   * feature-detect this method before calling it.
   */
  isVersionAtLeast?: (version: string) => boolean;
  /**
   * Bot API 8.0+: insets the client's own chrome (status bar, home
   * indicator, etc.) occupies, in fullscreen mode. Preferred over CSS
   * `env(safe-area-inset-*)` when present, since it reflects Telegram's
   * own reported chrome rather than the OS/browser's guess. Optional —
   * absent on older clients.
   */
  safeAreaInset?: TelegramSafeAreaInset;
  /**
   * Bot API 8.0+: like `safeAreaInset`, but also accounts for Telegram's
   * own in-app UI (e.g. the header) layered on top of the OS chrome.
   * Optional — absent on older clients.
   */
  contentSafeAreaInset?: TelegramSafeAreaInset;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export {};
