import { Component, ElementRef, ViewChild, AfterViewInit, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ConfigService } from '../../core/services/config.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements AfterViewInit {
  private configService = inject(ConfigService);
  readonly brandName = this.configService.brandName;
  readonly publicSiteUrl = this.configService.publicSiteUrl;
  readonly version = this.configService.version;

  @ViewChild('sidebarNav') sidebarNavRef?: ElementRef<HTMLDivElement>;

  readonly canScrollLeft = signal(false);
  readonly canScrollRight = signal(false);

  ngAfterViewInit(): void {
    // Check initial scroll state
    setTimeout(() => this.checkScroll(), 50);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkScroll();
  }

  onNavScroll(_event?: Event): void {
    this.checkScroll();
  }

  private checkScroll(): void {
    const el = this.sidebarNavRef?.nativeElement;
    if (!el) return;
    this.canScrollLeft.set(el.scrollLeft > 2);
    this.canScrollRight.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }
}
