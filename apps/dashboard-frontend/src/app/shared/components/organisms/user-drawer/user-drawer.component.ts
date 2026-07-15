import { Component, Input, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerService } from '../../../../core/services/drawer.service';
import { ActionHelperService } from '../../../services/action-helper.service';

@Component({
  selector: 'app-user-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-drawer.component.html',
  styleUrls: ['./user-drawer.component.css']
})
export class UserDrawerComponent implements OnChanges {
  drawerService = inject(DrawerService);
  actionHelper = inject(ActionHelperService);
  @Input() userId: string | null = null;

  mockUser: any = {};
  parsedProfile: { [key: string]: string[] } = {
    attributes: [],
    preferences: [],
    concerns: [],
    important_memories: []
  };

  isActionLoading = false;
  isBlocked = false;
  isSavingProfile = false;

  ngOnChanges() {
    const defaultCoreProfile = '{\n  "attributes": ["student", "tokyo"],\n  "preferences": ["anime", "programming"],\n  "concerns": ["exams"],\n  "important_memories": ["promised to go to comiket"]\n}';
    
    if (this.userId === '@rebecca_oshi') {
      this.mockUser = {
        handle: '@rebecca_oshi', name: 'レベッカ推し', interactions: 240, affinityScore: '98%', firstSeen: '2025-08-01', lastSeen: '2026-07-10',
        coreProfile: defaultCoreProfile,
        chatHistory: [
          { from: 'user', text: 'レベッカちゃんおはよう！', time: '2026-07-10 08:00' },
          { from: 'rebecca', text: 'おはよう！今日も1日頑張ろうね', time: '2026-07-10 08:05' }
        ]
      };
    } else if (this.userId === '@tech_geek_tokyo') {
      this.mockUser = {
        handle: '@tech_geek_tokyo', name: 'Tech Geek', interactions: 85, affinityScore: '70%', firstSeen: '2026-01-15', lastSeen: '2026-07-09',
        coreProfile: '{\n  "attributes": ["engineer", "adult"],\n  "preferences": ["ai", "tech"],\n  "concerns": ["burnout"],\n  "important_memories": []\n}',
        chatHistory: [
          { from: 'user', text: '新しいAIモデルの論文読んだ？', time: '2026-07-09 10:00' },
          { from: 'rebecca', text: '読んだよ！なかなか面白かったね', time: '2026-07-09 10:15' }
        ]
      };
    } else if (this.userId === '@user_alpha_99') {
      this.mockUser = {
        handle: '@user_alpha_99', name: 'Alpha 99', interactions: 42, affinityScore: '45%', firstSeen: '2026-05-01', lastSeen: '2026-07-11',
        coreProfile: '{\n  "attributes": ["gamer"],\n  "preferences": ["gaming"],\n  "concerns": [],\n  "important_memories": []\n}',
        chatHistory: [
          { from: 'user', text: 'よろしく', time: '2026-07-11 10:00' },
          { from: 'rebecca', text: 'よろしくね！', time: '2026-07-11 10:05' }
        ]
      };
    } else {
      this.mockUser = {
        handle: this.userId || '@gundam_fan_88', name: 'Gundam Fan 88', interactions: 156, affinityScore: '92%', firstSeen: '2025-10-01', lastSeen: '2026-07-11',
        coreProfile: '{\n  "attributes": ["fan"],\n  "preferences": ["gundam", "mecha"],\n  "concerns": [],\n  "important_memories": []\n}',
        chatHistory: [
          { from: 'user', text: 'レベッカ、今日のガンダムの話聞いた？', time: '2026-07-11 12:00' },
          { from: 'rebecca', text: '聞いてないよ！教えて 何かあったの？', time: '2026-07-11 12:01' }
        ]
      };
    }

    try {
      this.parsedProfile = JSON.parse(this.mockUser.coreProfile);
      // Ensure all arrays exist
      ['attributes', 'preferences', 'concerns', 'important_memories'].forEach(key => {
        if (!this.parsedProfile[key]) this.parsedProfile[key] = [];
      });
    } catch (e) {
      this.parsedProfile = { attributes: [], preferences: [], concerns: [], important_memories: [] };
    }
  }

  removeTag(category: string, index: number) {
    this.parsedProfile[category].splice(index, 1);
  }

  addTag(category: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    if (value) {
      this.parsedProfile[category].push(value);
      input.value = '';
    }
  }

  async onBlockUser() {
    this.isActionLoading = true;
    const actionName = this.isBlocked ? 'unblocked' : 'blocked';
    await this.actionHelper.executeMockAction(`Successfully ${actionName} user ${this.mockUser.name}`);
    this.isBlocked = !this.isBlocked;
    this.isActionLoading = false;
  }

  async onSaveProfile() {
    this.isSavingProfile = true;
    // Simulate re-serialization
    this.mockUser.coreProfile = JSON.stringify(this.parsedProfile, null, 2);
    await this.actionHelper.executeMockAction(`Successfully saved core profile for ${this.mockUser.name}`);
    this.isSavingProfile = false;
  }
}
