import { Component, Output, EventEmitter, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DrawerService } from '../../core/services/drawer.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './top-nav.component.html',
  styleUrls: ['./top-nav.component.css']
})
export class TopNavComponent {
  @Output() openDrawer = new EventEmitter<void>();
  private drawerService = inject(DrawerService);
  private translationService = inject(TranslationService);
  isUserDropdownOpen = false;
  user: any = null;

  constructor(private eRef: ElementRef, private authService: AuthService, private router: Router) {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
    });
  }

  get pageTitle(): string {
    const url = this.router.url;
    if (url.includes('/memory')) return this.translationService.t('nav.memory');
    if (url.includes('/assets')) return this.translationService.t('nav.assets');
    if (url.includes('/users')) return this.translationService.t('nav.users');
    if (url.includes('/settings')) return this.translationService.t('nav.settings');
    return this.translationService.t('nav.dashboard');
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
