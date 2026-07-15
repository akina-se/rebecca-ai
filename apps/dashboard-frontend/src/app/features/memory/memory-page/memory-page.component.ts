import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../shared/services/toast.service';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { MemoryDrawerComponent } from '../../../shared/components/organisms/memory-drawer/memory-drawer.component';

@Component({
  selector: 'app-memory-page',
  standalone: true,
  imports: [CommonModule, RightDrawerComponent, MemoryDrawerComponent],
  templateUrl: './memory-page.component.html',
  styleUrls: ['./memory-page.component.css']
})
export class MemoryPageComponent implements OnInit {
  toastService = inject(ToastService);
  isDreaming = false;
  
  isDrawerOpen = false;
  drawerLevel = 0;
  drawerTitle = '';
  drawerIcon = 'dns';

  constructor() {}

  ngOnInit() {
  }

  openDrawer(level: number, title: string, icon: string) {
    this.drawerLevel = level;
    this.drawerTitle = title;
    this.drawerIcon = icon;
    this.isDrawerOpen = true;
  }

  mockAlert(msg: string) {
    this.toastService.show(msg, 'info');
  }

  async forceDreaming() {
    if (this.isDreaming) return;
    
    this.isDreaming = true;
    this.toastService.show('Started background batch processing for Force Dreaming...', 'info');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    this.isDreaming = false;
    this.toastService.show('Force Dreaming completed successfully. Memory aligned.', 'success');
  }
}
