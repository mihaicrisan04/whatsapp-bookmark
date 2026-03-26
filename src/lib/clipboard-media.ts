import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const VIDEO_EXTS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".3gp"];
const MEDIA_EXTS = [...IMAGE_EXTS, ...VIDEO_EXTS];

export type ClipboardContent =
  | { type: "text"; text: string }
  | { type: "url"; url: string }
  | { type: "file"; filePath: string }
  | { type: "image"; filePath: string }
  | { type: "empty" };

/**
 * Try to save a clipboard image (bitmap data) to a temp PNG file via AppleScript.
 * Returns the file path or null if no image on clipboard.
 */
function saveClipboardImage(): string | null {
  const tempPath = join(tmpdir(), `whatsapp-clipboard-${Date.now()}.png`);
  try {
    execSync(`osascript -e '
      set tempFile to POSIX file "${tempPath}"
      try
        set imgData to the clipboard as «class PNGf»
        set fp to open for access tempFile with write permission
        write imgData to fp
        close access fp
        return "ok"
      on error
        return "no image"
      end try
    '`, { timeout: 5000 }).toString().trim();

    if (existsSync(tempPath)) {
      return tempPath;
    }
  } catch {
    // no image data on clipboard
  }
  return null;
}

export function readClipboard(text?: string, file?: string): ClipboardContent {
  // file copied from Finder
  if (file && existsSync(file)) {
    return { type: "file", filePath: file };
  }

  // text content
  if (text) {
    const urlPattern = /^https?:\/\/[^\s]+$/;
    if (urlPattern.test(text.trim())) {
      return { type: "url", url: text.trim() };
    }
    return { type: "text", text };
  }

  // try to grab image bitmap from pasteboard
  const imagePath = saveClipboardImage();
  if (imagePath) {
    return { type: "image", filePath: imagePath };
  }

  return { type: "empty" };
}

export function describeContent(content: ClipboardContent): string {
  switch (content.type) {
    case "url": return content.url;
    case "text": return content.text.length > 60 ? content.text.slice(0, 60) + "..." : content.text;
    case "file": return content.filePath.split("/").pop() || "file";
    case "image": return "clipboard image";
    case "empty": return "";
  }
}
