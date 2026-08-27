import { Component, Input, OnChanges, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DrawerService } from '../../../../core/services/drawer.service';
import { ToastService } from '../../../services/toast.service';
import { USERS_REPOSITORY } from '../../../../core/ports/users.repository';
import { UserDetail, UserStatus } from '@rebecca/types';
import { TzDatePipe } from '../../../pipes/tz-date.pipe';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { CopilotContextService } from '../../../../core/services/copilot-context.service';

/**
 * Component representing the User Drawer organism.
 * 
 * Provides a detailed view for a single user, displaying their status,
 * statistics, and core profile. Allows administrators to view/edit profile
 * tags and block/unblock the user.
 */
@Component({
  selector: 'app-user-drawer',
  standalone: true,
  imports: [FormsModule, TzDatePipe, TranslatePipe],
  templateUrl: './user-drawer.component.html',
  styleUrls: ['./user-drawer.component.css']
})
export class UserDrawerComponent implements OnChanges {
  /** Injected service to control drawer state and visibility. */
  drawerService = inject(DrawerService);
  
  /** Injected service for displaying toast notifications. */
  toastService = inject(ToastService);

  /** Injected context service for AI copilot context tracking. */
  contextService = inject(CopilotContextService);
  
  /** The ID of the user to display details for. */
  @Input() userId: string | null = null;

  /** The detailed information of the loaded user. */
  readonly user = signal<UserDetail | undefined>(undefined);

  /** The parsed core profile of the user, organized by category. */
  readonly parsedProfile = signal<Record<string, string[]>>({
    attributes: [],
    preferences: [],
    concerns: [],
    important_memories: []
  });

  /** Indicates if a block/unblock action is currently in progress. */
  readonly isActionLoading = signal<boolean>(false);
  
  /** Indicates if the currently loaded user is blocked. */
  readonly isBlocked = signal<boolean>(false);
  
  /** Indicates if a profile save operation is currently in progress. */
  readonly isSavingProfile = signal<boolean>(false);
  private readonly usersRepo = inject(USERS_REPOSITORY);

  /**
   * Lifecycle hook that is called when any data-bound property of a directive changes.
   * Triggers the loading of user details if a new `userId` is provided.
   */
  ngOnChanges() {
    if (!this.userId) return;
    this.usersRepo.getById(this.userId).subscribe({
      next: (u) => {
        this.user.set(u);
        this.isBlocked.set(u.status === UserStatus.BLOCKED);
        this.contextService.setFocusedEntity({
          type: 'user',
          id: u.id,
          label: u.username ? `@${u.username}` : (u.name || u.id),
          details: { interactions: u.interactions, status: u.status, firstSeen: u.firstSeen, lastSeen: u.lastSeen }
        });
        try {
          const parsed = JSON.parse(u.coreProfile) as Record<string, string[]>;
          ['attributes', 'preferences', 'concerns', 'important_memories'].forEach(key => {
            if (!parsed[key]) parsed[key] = [];
          });
          this.parsedProfile.set(parsed);
        } catch (error) {
          console.error('Failed to parse coreProfile JSON', error);
          this.parsedProfile.set({ attributes: [], preferences: [], concerns: [], important_memories: [] });
        }
      },
      error: (err) => {
        console.error('Failed to fetch user details:', err);
      }
    });
  }

  /**
   * Removes a tag from a specific profile category.
   * 
   * @param category - The category to remove the tag from (e.g., 'attributes').
   * @param index - The index of the tag to remove within the category array.
   */
  removeTag(category: string, index: number) {
    const current = { ...this.parsedProfile() };
    if (current[category]) {
      current[category] = current[category].filter((_, i) => i !== index);
      this.parsedProfile.set(current);
    }
  }

  /**
   * Adds a new tag to a specific profile category.
   * 
   * @param category - The category to add the tag to.
   * @param event - The keyboard event or focus out event triggering the addition.
   */
  addTag(category: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    if (value) {
      const current = { ...this.parsedProfile() };
      if (!current[category]) current[category] = [];
      current[category] = [...current[category], value];
      this.parsedProfile.set(current);
      input.value = '';
    }
  }

  /**
   * Saves the updated profile data to the backend repository.
   */
  onSaveProfile() {
    const u = this.user();
    if (!u) return;
    this.isSavingProfile.set(true);
    this.usersRepo.updateMemory(u.id, JSON.stringify(this.parsedProfile())).subscribe({
      next: () => {
        this.toastService.show('Profile updated successfully', 'success');
        this.isSavingProfile.set(false);
      },
      error: (err) => {
        console.error('Failed to update profile:', err);
        this.toastService.show('Failed to update profile', 'error');
        this.isSavingProfile.set(false);
      }
    });
  }

  /**
   * Toggles the user's status between blocked and active.
   */
  onBlockUser() {
    const u = this.user();
    if (!u) return;
    const newStatus = this.isBlocked() ? UserStatus.ACTIVE : UserStatus.BLOCKED;
    this.isActionLoading.set(true);
    this.usersRepo.bulkUpdateStatus([u.id], newStatus).subscribe({
      next: () => {
        this.isBlocked.set(newStatus === UserStatus.BLOCKED);
        this.isActionLoading.set(false);
        this.toastService.show(`User ${this.isBlocked() ? 'blocked' : 'unblocked'} successfully`, 'success');
      },
      error: (err) => {
        console.error('Failed to update user status:', err);
        this.toastService.show('Failed to update status', 'error');
        this.isActionLoading.set(false);
      }
    });
  }

  /**
   * Opens the user's profile page on X (Twitter) in a new tab.
   */
  onViewOnX(): void {
    const u = this.user();
    if (!u) return;
    const username = (u.username || u.id).replace(/^@/, '').trim();
    if (!username) return;
    const url = `https://x.com/${encodeURIComponent(username)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
