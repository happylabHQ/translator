// The translation API supplies append-only deltas, with no sentence-final event.
// Keep only the last locally completed sentence and a bounded current fragment.
export class Captions {
  constructor() { this.reset(); }
  reset() { this.previous = ''; this.current = ''; }
  append(delta) {
    this.current += delta;
    const boundary = /[.!?]["”')]*\s+/g;
    let match;
    let end = 0;
    while ((match = boundary.exec(this.current))) {
      this.previous = this.current.slice(end, match.index + match[0].length).trim();
      end = match.index + match[0].length;
    }
    if (end) this.current = this.current.slice(end);
    this.current = this.current.slice(-2000);
    this.previous = this.previous.slice(-2000);
  }
}
