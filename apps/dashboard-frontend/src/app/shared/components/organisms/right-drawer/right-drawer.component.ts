import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawerService } from '../../../../core/services/drawer.service';

@Component({
  selector: 'app-right-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './right-drawer.component.html',
  styleUrls: ['./right-drawer.component.css']
})
export class RightDrawerComponent implements OnInit {
  @Input() isOpen = false;
  @Input() title = 'Details';
  @Input() icon = 'info';
  
  @Output() closeDrawer = new EventEmitter<void>();

  isAiDrawerOpen = false;

  constructor(private drawerService: DrawerService) {}

  ngOnInit() {
    this.drawerService.isOpen$.subscribe(isOpen => {
      this.isAiDrawerOpen = isOpen;
    });
  }

  close() {
    this.closeDrawer.emit();
  }

  openAiCopilot() {
    this.drawerService.open();
  }
}
