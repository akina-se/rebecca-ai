import { Component, EventEmitter, Input, Output, OnInit, inject, signal } from '@angular/core';

import { DrawerService } from '../../../../core/services/drawer.service';

@Component({
  selector: 'app-right-drawer',
  standalone: true,
  imports: [],
  templateUrl: './right-drawer.component.html',
  styleUrls: ['./right-drawer.component.css']
})
export class RightDrawerComponent implements OnInit {
  @Input() isOpen = false;
  @Input() title = 'Details';
  @Input() icon = 'info';
  
  @Output() closeDrawer = new EventEmitter<void>();

  readonly isAiDrawerOpen = signal<boolean>(false);
  private readonly drawerService = inject(DrawerService);

  ngOnInit() {
    this.drawerService.isOpen$.subscribe(isOpen => {
      this.isAiDrawerOpen.set(isOpen);
    });
  }

  close() {
    this.closeDrawer.emit();
  }

  openAiCopilot() {
    this.drawerService.open();
  }
}
