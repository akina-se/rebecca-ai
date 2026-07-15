import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-memory-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="level === 0">
      <h4 style="margin-bottom: 1rem; color: var(--color-primary);">System Prompt</h4>
      <pre style="background: rgba(0,0,0,0.5); padding: 1rem; border-radius: 8px; color: var(--text-main); white-space: pre-wrap; font-family: monospace;">{{ getMockData(0) }}</pre>
    </div>
    <div *ngIf="level === 1">
      <h4 style="margin-bottom: 1rem; color: var(--color-primary);">Recent Logs</h4>
      <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        <span style="color: var(--text-muted); font-size: 0.8rem;">[10:00:05]</span> User: Hello!<br>
        <span style="color: var(--text-muted); font-size: 0.8rem;">[10:00:07]</span> Rebecca: Hi there. What's up?
      </div>
    </div>
    <div *ngIf="level === 2">
      <h4 style="margin-bottom: 1rem; color: var(--color-primary);">User Profile JSON</h4>
      <pre style="background: rgba(0,0,0,0.5); padding: 1rem; border-radius: 8px; color: #a29bfe; font-family: monospace;">{{ '{' }}
  "interests": ["anime", "programming"],
  "sentiment": "positive"
{{ '}' }}</pre>
    </div>
    <div *ngIf="level === 3">
      <h4 style="margin-bottom: 1rem; color: var(--color-primary);">Global Context</h4>
      <p style="color: var(--text-muted); line-height: 1.5;">The overall sentiment of the timeline is currently highly positive, largely driven by the recent anime announcements.</p>
    </div>
  `
})
export class MemoryDrawerComponent {
  @Input() level: number = 0;

  getMockData(level: number) {
    if (level === 0) return "You are Rebecca, a sassy but highly competent AI assistant.\n\nStrict directives:\n1. Never break character.\n2. Prioritize user safety.\n3. Be concise.";
    return "";
  }
}
