import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertText } from "../insertion";

declare global {
  interface Navigator {
    clipboard?: { writeText: (data: string) => Promise<void> };
  }
}

const originalExecCommand = (document as Document & { execCommand?: typeof document.execCommand }).execCommand;

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error reset clipboard mock between tests
  delete navigator.clipboard;
  if (originalExecCommand) {
    Object.defineProperty(document, "execCommand", {
      value: originalExecCommand,
      configurable: true,
    });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (document as any).execCommand;
  }
});

describe("insertText", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("uses clipboard paste when available", async () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-testid", "tweetTextarea_0");
    const input = document.createElement("div");
    input.setAttribute("contenteditable", "true");
    wrapper.append(input);
    document.body.append(wrapper);

    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWrite },
    });

    const execCommand = vi.fn((command: string) => command === "paste");
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
      writable: true,
    });

    const result = await insertText("hello world");
    expect(result).toBe(true);
    expect(clipboardWrite).toHaveBeenCalledWith("hello world");
    expect(execCommand).toHaveBeenCalledWith("paste");
  });

  it("falls back to execCommand insert when clipboard fails and composer opens later", async () => {
    const button = document.createElement("button");
    button.setAttribute("data-testid", "SideNav_NewTweet_Button");
    let composedInput: HTMLDivElement | null = null;
    button.addEventListener("click", () => {
      const wrapper = document.createElement("div");
      wrapper.setAttribute("data-testid", "tweetTextarea_0");
      const editor = document.createElement("div");
      editor.setAttribute("contenteditable", "true");
      composedInput = editor;
      wrapper.append(editor);
      document.body.append(wrapper);
    });
    document.body.append(button);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });

    const execCommand = vi.fn((command: string, _showUI?: boolean, value?: string) => {
      if (command === "insertText" && composedInput && value) {
        composedInput.textContent = value;
        return true;
      }
      return false;
    });

    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
      writable: true,
    });

    const result = await insertText("fallback path");
    expect(result).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("insertText", false, "fallback path");
    expect(composedInput?.textContent).toBe("fallback path");
  });
});
