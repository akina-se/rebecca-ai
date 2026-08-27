import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { UserDrawerComponent } from '../../../shared/components/organisms/user-drawer/user-drawer.component';
import { PaginationComponent } from '../../../shared/components/molecules/pagination/pagination.component';
import { TzDatePipe } from '../../../shared/pipes/tz-date.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { USERS_REPOSITORY } from '../../../core/ports/users.repository';
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

  readonly users = signal<UserDetail[]>([]);
  selectedUsers = new Set<string>();
  selectAll = false;

  // Search & Pagination & Sorting
  searchQuery = '';
  currentPage = 1;
  pageSize = 30;
  readonly totalPages = signal<number>(1);
  readonly totalItems = signal<number>(0);

  userSortBy: 'username' | 'interactions' | 'lastSeen' = 'interactions';
  userSortOrder: 'asc' | 'desc' = 'desc';

  isBlocking = false;
  isUnblocking = false;
  readonly isLoading = signal<boolean>(false);

  toastService = inject(ToastService);
  private readonly usersRepo = inject(USERS_REPOSITORY);

  ngOnInit() {
    this.loadUsers(1);
  }

  loadUsers(page = 1) {
    this.isLoading.set(true);
    this.currentPage = page;
    this.usersRepo.getAll({
      page: this.currentPage,
      limit: this.pageSize,
      search: this.searchQuery,
      sortBy: this.userSortBy,
      sortOrder: this.userSortOrder
    }).subscribe({
      next: (response) => {
        const items = response.data || [];
        this.users.set(items);
        const count = response.meta?.totalItems || items.length;
        this.totalItems.set(count);
        this.totalPages.set(response.meta?.totalPages || Math.ceil(count / this.pageSize) || 1);
        this.selectedUsers.clear();
        this.selectAll = false;
        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.show('Failed to load users', 'error');
        this.isLoading.set(false);
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
      this.users().forEach(u => this.selectedUsers.add(u.id));
    } else {
      this.selectedUsers.clear();
    }
  }

  toggleSelection(userId: string, event: Event) {
    event.stopPropagation();
    if (this.selectedUsers.has(userId)) {
      this.selectedUsers.delete(userId);
    } else {
      this.selectedUsers.add(userId);
    }
    this.selectAll = this.selectedUsers.size === this.users().length && this.users().length > 0;
  }

  openUserDrawer(userOrId: UserDetail | string) {
    if (typeof userOrId === 'string') {
      const user = this.users().find(u => u.id === userOrId);
      this.selectedUserId = userOrId;
      this.drawerTitle = `@${user?.username || userOrId}`;
    } else {
      this.selectedUserId = userOrId.id;
      this.drawerTitle = `@${userOrId.username || userOrId.id}`;
    }
    this.drawerIcon = 'person';
    this.isDrawerOpen = true;
  }

  onUserUpdated() {
    this.loadUsers(this.currentPage);
  }

  executeBulkBlock() {
    if (this.selectedUsers.size === 0) return;
    const ids = Array.from(this.selectedUsers);
    this.isBlocking = true;

    this.usersRepo.bulkUpdateStatus(ids, UserStatus.BLOCKED).subscribe({
      next: () => {
        this.toastService.show(`Blocked ${ids.length} user(s)`, 'success');
        this.isBlocking = false;
        this.loadUsers(this.currentPage);
      },
      error: () => {
        this.toastService.show('Failed to block users', 'error');
        this.isBlocking = false;
      }
    });
  }

  executeBulkUnblock() {
    if (this.selectedUsers.size === 0) return;
    const ids = Array.from(this.selectedUsers);
    this.isUnblocking = true;

    this.usersRepo.bulkUpdateStatus(ids, UserStatus.ACTIVE).subscribe({
      next: () => {
        this.toastService.show(`Unblocked ${ids.length} user(s)`, 'success');
        this.isUnblocking = false;
        this.loadUsers(this.currentPage);
      },
      error: () => {
        this.toastService.show('Failed to unblock users', 'error');
        this.isUnblocking = false;
      }
    });
  }

  getStatusBadgeClass(status: UserStatus): string {
    switch (status) {
      case UserStatus.ACTIVE: return 'status-active';
      case UserStatus.BLOCKED: return 'status-blocked';
      case UserStatus.MUTED: return 'status-muted';
      default: return 'status-active';
    }
  }
}
