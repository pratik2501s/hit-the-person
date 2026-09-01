export function $(selector: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el as HTMLElement;
}

export function $$(selector: string, root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll(selector)] as HTMLElement[];
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
