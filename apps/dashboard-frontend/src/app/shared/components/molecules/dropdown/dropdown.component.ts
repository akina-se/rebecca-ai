import { Component, Input, Output, EventEmitter, ElementRef, HostListener, inject } from '@angular/core';


@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [],
  templateUrl: './dropdown.component.html',
  styleUrls: ['./dropdown.component.css']
})
export class DropdownComponent {
  @Input() options: string[] = [];
  @Input() selectedOption = '';
  @Input() icon?: string;
  @Output() selectionChange = new EventEmitter<string>();

  isOpen = false;
  private readonly eRef = inject(ElementRef);

  toggle() {
    this.isOpen = !this.isOpen;
  }

  selectOption(option: string) {
    this.selectedOption = option;
    this.selectionChange.emit(option);
    this.isOpen = false;
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if(!this.eRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }
}
