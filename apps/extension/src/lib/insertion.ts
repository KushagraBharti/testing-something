const composerSelectors = [
  'div[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
  'div[data-testid="tweetTextarea_1"] div[contenteditable="true"]',
  'div[role="textbox"][contenteditable="true"]',
];

export const insertIntoComposer = (text: string): boolean => {
  for (const selector of composerSelectors) {
    const node = document.querySelector(selector) as HTMLElement | null;
    if (node) {
      node.focus();
      document.execCommand("selectAll", false);
      document.execCommand("insertText", false, text);
      node.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
  }
  return false;
};
