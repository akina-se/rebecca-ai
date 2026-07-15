import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-drawer.component.html',
  styleUrls: ['./user-drawer.component.css']
})
export class UserDrawerComponent {
  @Input() userId: string | null = null;

  mockUser = {
    handle: '@gundam_fan_88',
    name: 'Gundam Fan 88',
    interactions: 156,
    affinityScore: '92%',
    firstSeen: '2025-10-01',
    lastSeen: '2026-07-11',
    chatHistory: [
      { from: 'user', text: 'レベッカ、今日のガンダムの話聞いた？', time: '2026-07-11 12:00' },
      { from: 'rebecca', text: '聞いてないよ！教えて🌟 何かあったの？', time: '2026-07-11 12:01' },
      { from: 'user', text: '水星の魔女の新作情報が出たんだよ！', time: '2026-07-11 12:02' },
      { from: 'rebecca', text: 'えっ！？マジで！？それは速報じゃん…詳細教えてほしいわ', time: '2026-07-11 12:02' },
      { from: 'user', text: 'またリプライするね！', time: '2026-07-10 18:00' },
      { from: 'rebecca', text: '待ってる～！いつもありがとう💜', time: '2026-07-10 18:01' },
    ]
  };
}
