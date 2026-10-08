// Drop old whole words instead of shrinking the font or starting another row.
export function fitSingleLine(text, width, measure) {
  text = text.replace(/\s+/g, ' ').trimStart();
  while (text && measure(text) > width) {
    const space = text.indexOf(' ');
    text = space >= 0 ? text.slice(space + 1) : text.slice(1);
  }
  return text;
}
