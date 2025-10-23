const COMPOSER_SELECTORS = [
  '[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
  '[data-testid="tweetTextarea_1"] div[contenteditable="true"]',
];

const TWEET_BUTTON_SELECTOR = '[data-testid="SideNav_NewTweet_Button"]';

const findComposer = (): HTMLElement | null => {
  for (const selector of COMPOSER_SELECTORS) {
    const node = document.querySelector(selector) as HTMLElement | null;
    if (node) {
      return node;
    }
  }
  return null;
};

const openComposer = () => {
  const trigger = document.querySelector(TWEET_BUTTON_SELECTOR) as HTMLElement | null;
  if (trigger) {
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }
};

const execInsert = (target: HTMLElement, text: string): boolean => {
  target.focus();
  const succeeded = document.execCommand('insertText', false, text);
  target.dispatchEvent(new Event('input', { bubbles: true }));
  return succeeded;
};

const attemptClipboardPaste = async (target: HTMLElement, text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    target.focus();
    const pasted = document.execCommand('paste');
    if (pasted) {
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  } catch (error) {
    // clipboard path not available
  }
  return false;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const insertText = async (text: string): Promise<boolean> => {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  let target = findComposer();

  if (!target) {
    openComposer();
    await delay(50);
    target = findComposer();
  }

  if (!target) {
    await delay(150);
    target = findComposer();
  }

  if (!target) {
    return false;
  }

  if (await attemptClipboardPaste(target, normalized)) {
    return true;
  }

  return execInsert(target, normalized);
};
