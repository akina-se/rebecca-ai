import { Component } from '@angular/core';
import { DrawerService } from '../../core/services/drawer.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [],
  templateUrl: './top-nav.component.html',
  styleUrl: './top-nav.component.css'
})
export class TopNavComponent {
  constructor(private drawerService: DrawerService) {}

  toggleDrawer() {
    this.drawerService.toggle();
  }
}
