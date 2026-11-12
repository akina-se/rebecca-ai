import { Component, Output, EventEmitter, HostListener, ElementRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DrawerService } from '../../core/services/drawer.service';
import { ConfigService } from '../../core/services/config.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './top-nav.component.html',
  styleUrls: ['./top-nav.component.css']
})
export class TopNavComponent {
  @Output() openDrawer = new EventEmitter<void>();
  private readonly drawerService = inject(DrawerService);
  private readonly translationService = inject(TranslationService);
  private readonly eRef = inject(ElementRef);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly configService = inject(ConfigService);

  isUserDropdownOpen = false;
  readonly currentUser = this.authService.currentUserSignal;

  get user(): { displayName?: string | null; email?: string | null; photoURL?: string | null } | null {
    return this.currentUser();
  }

  get pageTitle(): string {
    const url = this.router.url ?? '';
    if (url.includes('/campaigns')) return this.translationService.t('nav.campaigns');
    if (url.includes('/memory')) return this.translationService.t('nav.memory');
    if (url.includes('/assets')) return this.translationService.t('nav.assets');
    if (url.includes('/users')) return this.translationService.t('nav.users');
    if (url.includes('/supporters')) return this.translationService.t('nav.supporters');
    if (url.includes('/settings')) return this.translationService.t('nav.settings');
    return this.translationService.t('nav.dashboard');
  }

  get personaName(): string {
    return this.configService.getPersonaName(this.translationService.currentLang());
  }

  /**
   * Derives a single uppercase initial for the user avatar when photoURL is absent.
   * Precedence: displayName -> email -> 'A' (Administrator fallback).
   */
  get userInitial(): string {
    const displayName = this.user?.displayName?.trim();
    if (displayName && displayName.length > 0) {
      return displayName.charAt(0).toUpperCase();
    }
    const email = this.user?.email?.trim();
    if (email && email.length > 0) {
      return email.charAt(0).toUpperCase();
    }
    return 'A';
  }

  get userAvatarUrl(): string {
    if (this.user?.photoURL) {
      return this.user.photoURL;
    }
    const initial = this.userInitial;
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="%238A2BE2"/><text x="18" y="23" font-size="14" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="bold">${encodeURIComponent(initial)}</text></svg>`;
  }

  toggleDrawer() {
    this.drawerService.toggle();
    this.openDrawer.emit();
  }

  toggleUserDropdown(event: Event) {
    event.stopPropagation();
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
  }

  navigateToSettings() {
    this.isUserDropdownOpen = false;
    this.router.navigate(['/settings']);
  }

  async logout() {
    this.isUserDropdownOpen = false;
    await this.authService.logout();
    await this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.isUserDropdownOpen = false;
    }
  }
}
