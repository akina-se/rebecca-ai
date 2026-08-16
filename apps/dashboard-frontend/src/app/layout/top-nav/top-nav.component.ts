import { Component, Output, EventEmitter, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DrawerService } from '../../core/services/drawer.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './top-nav.component.html',
  styleUrls: ['./top-nav.component.css']
})
export class TopNavComponent {
  @Output() openDrawer = new EventEmitter<void>();
  private drawerService = inject(DrawerService);
  isUserDropdownOpen = false;
  user: any = null;

  constructor(private eRef: ElementRef, private authService: AuthService, private router: Router) {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
    });
  }

  get pageTitle(): string {
    const url = this.router.url;
    if (url.includes('/memory')) return 'Memory Management';
    if (url.includes('/assets')) return 'Assets Library';
    if (url.includes('/users')) return 'User Relations';
    if (url.includes('/settings')) return 'Settings';
    return 'Dashboard';
  }

  get userAvatarUrl(): string {
    const name = this.user?.displayName || 'Admin User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8A2BE2&color=fff&rounded=true`;
  }

  toggleDrawer() {
    this.drawerService.toggle();
    this.openDrawer.emit();
  }

  toggleUserDropdown(event: Event) {
    event.stopPropagation();
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
  }

  logout() {
    console.log('Logging out...');
    this.isUserDropdownOpen = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if(!this.eRef.nativeElement.contains(event.target)) {
      this.isUserDropdownOpen = false;
    }
  }
}
