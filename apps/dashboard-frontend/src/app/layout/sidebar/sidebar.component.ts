import { Component, inject } from '@angular/core';
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
export class SidebarComponent {
  private configService = inject(ConfigService);
  readonly brandName = this.configService.brandName;
  readonly publicSiteUrl = this.configService.publicSiteUrl;
  readonly version = this.configService.version;
}
