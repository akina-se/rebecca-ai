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
    this.drawerService.isOpen$.subscribe({
      next: (isOpen: boolean) => {
        this.isOpen = isOpen;
      },
      error: (err: any) => {
        console.error(err);
      }
    });
  }

  close() {
    this.drawerService.close();
  }
}
