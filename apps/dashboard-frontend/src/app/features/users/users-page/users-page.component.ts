import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { UserDrawerComponent } from '../../../shared/components/organisms/user-drawer/user-drawer.component';
import { ActionHelperService } from '../../../shared/services/action-helper.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, RightDrawerComponent, UserDrawerComponent],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.css'
})
export class UsersPageComponent {
  isDrawerOpen = false;
  selectedUserId: string | null = null;
  drawerTitle = '';
  drawerIcon = '';

  mockUsers = ['@user_alpha_99', '@rebecca_oshi', '@spam_bot_001'];
  selectedUsers = new Set<string>();
  selectAll = false;

  isBlocking = false;
  isUnblocking = false;

  mockAlert(msg: string) {
    alert(msg);
  }

  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.mockUsers.forEach(u => this.selectedUsers.add(u));
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
    this.selectAll = this.selectedUsers.size === this.mockUsers.length;
  }

  actionHelper = inject(ActionHelperService);

  async executeBulkBlock() {
    if (this.selectedUsers.size === 0) return;
    this.isBlocking = true;
    await this.actionHelper.executeMockAction(`Successfully blocked ${this.selectedUsers.size} users`);
    this.selectedUsers.clear();
    this.selectAll = false;
    this.isBlocking = false;
  }

  async executeBulkUnblock() {
    if (this.selectedUsers.size === 0) return;
    this.isUnblocking = true;
    await this.actionHelper.executeMockAction(`Successfully unblocked ${this.selectedUsers.size} users`);
    this.selectedUsers.clear();
    this.selectAll = false;
    this.isUnblocking = false;
  }

  openUserDrawer(id: string) {
    if ((window.getSelection()?.toString() || '').trim().length > 0) return;
    this.selectedUserId = id;
    this.drawerTitle = 'User Profile';
    this.drawerIcon = 'person';
    this.isDrawerOpen = true;
  }
}
