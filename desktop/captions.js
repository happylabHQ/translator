// Two fixed rows: complete phrases stay above the phrase still arriving.
// A full row also completes a block, so long sentences never scroll sideways.
export class OverlayCaptions {
  constructor() { this.reset(); }
  reset() { this.previous = ''; this.current = ''; }
  append(delta) { this.current = (this.current + delta).replace(/\s+/g, ' ').slice(-2000); }
  layout(width, measure) {
    if (width <= 0) return { previous: '', current: '' };
    for (;;) {
      this.current = this.current.trimStart();
      const sentence = /[.!?]["”')]*\s+/.exec(this.current);
      const sentenceEnd = sentence && sentence.index + sentence[0].length;
      if (sentenceEnd && measure(this.current.slice(0, sentenceEnd).trim()) <= width) {
        this.previous = this.current.slice(0, sentenceEnd).trim();
        this.current = this.current.slice(sentenceEnd);
        continue;
      }
      if (measure(this.current.trimEnd()) <= width) break;
      let end = 0;
      for (const match of this.current.matchAll(/\s+/g)) {
        if (measure(this.current.slice(0, match.index)) > width) break;
        end = match.index + match[0].length;
      }
      if (!end) {
        // An individual token can exceed the row width. Keep its remainder.
        for (const character of this.current) {
          if (measure(this.current.slice(0, end) + character) > width && end) break;
          end += character.length;
        }
      }
      this.previous = this.current.slice(0, end).trim();
      this.current = this.current.slice(end);
    }
    // When shrinking the overlay, reflow the retained completed block too.
    while (this.previous && measure(this.previous) > width) {
      const space = this.previous.indexOf(' ');
      this.previous = space >= 0 ? this.previous.slice(space + 1) : this.previous.slice(1);
    }
    return { previous: this.previous, current: this.current.trimEnd() };
  }
}
