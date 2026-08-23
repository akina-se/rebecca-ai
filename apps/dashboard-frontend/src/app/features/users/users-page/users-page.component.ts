import { Component, OnInit, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { UserDrawerComponent } from '../../../shared/components/organisms/user-drawer/user-drawer.component';
import { PaginationComponent } from '../../../shared/components/molecules/pagination/pagination.component';
import { TzDatePipe } from '../../../shared/pipes/tz-date.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { USERS_REPOSITORY, UsersRepository } from '../../../core/ports/users.repository';
import { UserDetail, UserStatus } from '@rebecca/types';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RightDrawerComponent, UserDrawerComponent, PaginationComponent, TzDatePipe, TranslatePipe],
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

  // Search & Pagination & Sorting
  searchQuery = '';
  currentPage = 1;
  pageSize = 30;
  totalPages = 1;
  totalItems = 0;

  userSortBy: 'username' | 'interactions' | 'lastSeen' = 'interactions';
  userSortOrder: 'asc' | 'desc' = 'desc';

  isBlocking = false;
  isUnblocking = false;
  isLoading = false;

  toastService = inject(ToastService);

  constructor(@Inject(USERS_REPOSITORY) private usersRepo: UsersRepository) {}

  ngOnInit() {
    this.loadUsers(1);
  }

  loadUsers(page = 1) {
    this.isLoading = true;
    this.currentPage = page;
    this.usersRepo.getAll({
      page: this.currentPage,
      limit: this.pageSize,
      search: this.searchQuery,
      sortBy: this.userSortBy,
      sortOrder: this.userSortOrder
    }).subscribe({
      next: (response) => {
        this.users = response.data || [];
        this.totalItems = response.meta?.totalItems || this.users.length;
        this.totalPages = response.meta?.totalPages || Math.ceil(this.totalItems / this.pageSize) || 1;
        this.selectedUsers.clear();
        this.selectAll = false;
        this.isLoading = false;
      },
      error: () => {
        this.toastService.show('Failed to load users', 'error');
        this.isLoading = false;
      }
    });
  }

  onSearchChange() {
    this.loadUsers(1);
  }

  onPageChange(page: number) {
    this.loadUsers(page);
  }

  toggleUserSort(column: 'username' | 'interactions' | 'lastSeen') {
    if (this.userSortBy === column) {
      this.userSortOrder = this.userSortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      this.userSortBy = column;
      this.userSortOrder = 'desc';
    }
    this.loadUsers(1);
  }

  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.users.forEach(u => this.selectedUsers.add(u.id));
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
