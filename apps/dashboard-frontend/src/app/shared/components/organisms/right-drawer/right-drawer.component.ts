import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-right-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './right-drawer.component.html',
  styleUrls: ['./right-drawer.component.css']
})
export class RightDrawerComponent {
  @Input() isOpen = false;
  @Input() title = 'Details';
  @Input() icon = 'info';
  
  @Output() closeDrawer = new EventEmitter<void>();

  close() {
    this.closeDrawer.emit();
  }
}
