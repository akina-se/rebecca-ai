import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../shared/services/toast.service';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { MemoryDrawerComponent } from '../../../shared/components/organisms/memory-drawer/memory-drawer.component';
import { ActionHelperService } from '../../../shared/services/action-helper.service';

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

  actionHelper = inject(ActionHelperService);

  async forceDreaming() {
    if (this.isDreaming) return;
    
    this.isDreaming = true;
    await this.actionHelper.executeMockAction('Force Dreaming completed successfully. Memory aligned.');
    this.isDreaming = false;
  }
}
