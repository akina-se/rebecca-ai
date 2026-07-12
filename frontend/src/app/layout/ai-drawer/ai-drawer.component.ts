import { Component } from '@angular/core';

@Component({
  selector: 'app-ai-drawer',
  standalone: true,
  imports: [],
  templateUrl: './ai-drawer.component.html',
  styleUrl: './ai-drawer.component.css'
})
export class AiDrawerComponent {
  isOpen = false;

  open() {
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
  }
}
