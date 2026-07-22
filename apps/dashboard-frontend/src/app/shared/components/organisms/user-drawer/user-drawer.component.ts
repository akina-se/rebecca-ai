import { Component, Input, OnChanges, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerService } from '../../../../core/services/drawer.service';
import { ToastService } from '../../../services/toast.service';
import { USERS_REPOSITORY, UsersRepository } from '../../../../core/ports/users.repository';
import { UserDetail, UserStatus } from '@rebecca/types';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './user-drawer.component.html',
  styleUrls: ['./user-drawer.component.css']
})
export class UserDrawerComponent implements OnChanges {
  /** Injected service to control drawer state and visibility. */
  drawerService = inject(DrawerService);
  
  /** Injected service for displaying toast notifications. */
  toastService = inject(ToastService);
  
  /** The ID of the user to display details for. */
  @Input() userId: string | null = null;

  /** The detailed information of the loaded user. */
  user?: UserDetail;

  /** The parsed core profile of the user, organized by category. */
  parsedProfile: Record<string, string[]> = {
    attributes: [],
    preferences: [],
    concerns: [],
    important_memories: []
  };

  /** Indicates if a block/unblock action is currently in progress. */
  isActionLoading = false;
  
  /** Indicates if the currently loaded user is blocked. */
  isBlocked = false;
  
  /** Indicates if a profile save operation is currently in progress. */
  isSavingProfile = false;

  /**
   * Initializes the user drawer component.
   * 
   * @param usersRepo - The injected repository for managing user data.
   */
  constructor(@Inject(USERS_REPOSITORY) private usersRepo: UsersRepository) {}

  /**
   * Lifecycle hook that is called when any data-bound property of a directive changes.
   * Triggers the loading of user details if a new `userId` is provided.
   */
  ngOnChanges() {
    if (!this.userId) return;
    this.usersRepo.getById(this.userId).subscribe({
      next: (u) => {
        this.user = u;
        this.isBlocked = u.status === UserStatus.BLOCKED;
        try {
          this.parsedProfile = JSON.parse(u.coreProfile) as Record<string, string[]>;
          ['attributes', 'preferences', 'concerns', 'important_memories'].forEach(key => {
            if (!this.parsedProfile[key]) this.parsedProfile[key] = [];
          });
        } catch (error) {
          console.error('Failed to parse coreProfile JSON', error);
          this.parsedProfile = { attributes: [], preferences: [], concerns: [], important_memories: [] };
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
    this.parsedProfile[category].splice(index, 1);
  }

  /**
   * Adds a new tag to a specific profile category based on user input.
   * 
   * @param category - The category to add the new tag to.
   * @param event - The DOM event triggered by the input field.
   */
  addTag(category: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    if (value) {
      this.parsedProfile[category].push(value);
      input.value = '';
    }
  }

  /**
   * Toggles the blocked status of the currently loaded user.
   * Persists the change to the repository.
   */
  async onBlockUser() {
    if (!this.userId) return;
    this.isActionLoading = true;
    const targetStatus = this.isBlocked ? UserStatus.ACTIVE : UserStatus.BLOCKED;
    this.usersRepo.bulkUpdateStatus([this.userId], targetStatus).subscribe({
      next: async () => {
        this.isBlocked = targetStatus === UserStatus.BLOCKED;
        if (this.user) {
          this.user.status = targetStatus;
        }
        this.toastService.show(`Successfully ${this.isBlocked ? 'blocked' : 'unblocked'} user ${this.userId}`, 'success');
        this.isActionLoading = false;
      },
      error: (err) => {
        console.error('Failed to update user status:', err);
        this.isActionLoading = false;
      }
    });
  }

  /**
   * Saves the modified core profile of the user to the repository.
   */
  async onSaveProfile() {
    if (!this.userId) return;
    this.isSavingProfile = true;
    const updatedProfile = JSON.stringify(this.parsedProfile, null, 2);
    this.usersRepo.updateMemory(this.userId, updatedProfile).subscribe({
      next: async () => {
        if (this.user) {
          this.user.coreProfile = updatedProfile;
        }
        this.toastService.show(`Successfully saved core profile for ${this.userId}`, 'success');
        this.isSavingProfile = false;
      },
      error: (err) => {
        console.error('Failed to save core profile:', err);
        this.isSavingProfile = false;
      }
    });
  }
}
