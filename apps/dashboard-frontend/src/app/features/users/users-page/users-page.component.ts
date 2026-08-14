import { Component, OnInit, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { UserDrawerComponent } from '../../../shared/components/organisms/user-drawer/user-drawer.component';
import { ActionHelperService } from '../../../shared/services/action-helper.service';
import { USERS_REPOSITORY, UsersRepository } from '../../../core/ports/users.repository';
import { UserDetail, UserStatus } from '@rebecca/types';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, RightDrawerComponent, UserDrawerComponent],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.css'
})
export class UsersPageComponent implements OnInit {
  isDrawerOpen = false;
  selectedUserId: string | null = null;
  drawerTitle = '';
  drawerIcon = '';

  users: UserDetail[] = [];
  selectedUsers = new Set<string>();
  selectAll = false;

  isBlocking = false;
  isUnblocking = false;
  isLoading = false;

  toastService = inject(ToastService);

  constructor(@Inject(USERS_REPOSITORY) private usersRepo: UsersRepository) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.isLoading = true;
    this.usersRepo.getAll().subscribe({
      next: (response) => {
        this.users = response.data;
        this.isLoading = false;
      },
      error: () => {
        this.toastService.show('Failed to load users', 'error');
        this.isLoading = false;
      }
    });
  }

  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.users.forEach(u => this.selectedUsers.add(u.handle));
    } else {
      this.selectedUsers.clear();
    }
  }

  toggleSelection(userId: string, event: Event) {
    event.stopPropagation();
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      this.selectedUsers.add(userId);
    } else {
      this.selectedUsers.delete(userId);
    }
    this.selectAll = this.selectedUsers.size === this.users.length && this.users.length > 0;
  }

  async executeBulkBlock() {
    if (this.selectedUsers.size === 0) return;
    this.isBlocking = true;
    this.usersRepo.bulkUpdateStatus(Array.from(this.selectedUsers), UserStatus.BLOCKED).subscribe({
      next: () => {
        this.toastService.show(`Successfully blocked ${this.selectedUsers.size} users`, 'success');
        this.selectedUsers.clear();
        this.selectAll = false;
        this.isBlocking = false;
        this.loadUsers();
      },
      error: () => {
        this.toastService.show('Failed to block users', 'error');
        this.isBlocking = false;
      }
    });
  }

  async executeBulkUnblock() {
    if (this.selectedUsers.size === 0) return;
    this.isUnblocking = true;
    this.usersRepo.bulkUpdateStatus(Array.from(this.selectedUsers), UserStatus.ACTIVE).subscribe({
      next: () => {
        this.toastService.show(`Successfully unblocked ${this.selectedUsers.size} users`, 'success');
        this.selectedUsers.clear();
        this.selectAll = false;
        this.isUnblocking = false;
        this.loadUsers();
      },
      error: () => {
        this.toastService.show('Failed to unblock users', 'error');
        this.isUnblocking = false;
      }
    });
  }

  openUserDrawer(id: string) {
    if ((window.getSelection()?.toString() || '').trim().length > 0) return;
    this.selectedUserId = id;
    this.drawerTitle = 'User Profile';
    this.drawerIcon = 'person';
    this.isDrawerOpen = true;
  }
}
