/**
 * Lightweight undo/redo history for contenteditable HTML snapshots.
 */
export function createHistory(limit = 50) {
  let stack = [];
  let index = -1;

  return {
    push(html) {
      if (index >= 0 && stack[index] === html) return;
      stack = stack.slice(0, index + 1);
      stack.push(html);
      if (stack.length > limit) {
        stack.shift();
      } else {
        index += 1;
      }
      if (index >= limit) index = limit - 1;
      index = stack.length - 1;
    },
    undo() {
      if (index <= 0) return null;
      index -= 1;
      return stack[index];
    },
    redo() {
      if (index >= stack.length - 1) return null;
      index += 1;
      return stack[index];
    },
    canUndo() {
      return index > 0;
    },
    canRedo() {
      return index < stack.length - 1;
    },
    current() {
      return index >= 0 ? stack[index] : null;
    },
    reset(html = '') {
      stack = [html];
      index = 0;
    },
  };
}
