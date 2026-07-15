import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawerService } from '../../core/services/drawer.service';

@Component({
  selector: 'app-ai-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-drawer.component.html',
  styleUrl: './ai-drawer.component.css'
})
export class AiDrawerComponent implements OnInit {
  isOpen = false;

  constructor(private drawerService: DrawerService) {}

  ngOnInit() {
    this.drawerService.isOpen$.subscribe(isOpen => {
      this.isOpen = isOpen;
    });
  }

  close() {
    this.drawerService.close();
  }
}
