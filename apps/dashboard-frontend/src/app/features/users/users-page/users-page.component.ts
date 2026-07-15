import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { UserDrawerComponent } from '../../../shared/components/organisms/user-drawer/user-drawer.component';

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

  mockAlert(msg: string) {
    alert(msg);
  }

  openUserDrawer(id: string) {
    this.selectedUserId = id;
    this.drawerTitle = 'User Profile';
    this.drawerIcon = 'person';
    this.isDrawerOpen = true;
  }
}
