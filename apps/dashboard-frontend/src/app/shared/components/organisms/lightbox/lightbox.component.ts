import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';


@Component({
  selector: 'app-lightbox',
  standalone: true,
  imports: [],
  templateUrl: './lightbox.component.html',
  styleUrls: ['./lightbox.component.css']
})
export class LightboxComponent {
  @Input() isOpen = false;
  @Input() imageUrl = '';
  @Output() lightboxClose = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onKeydownHandler() {
    if (this.isOpen) {
      this.closeLightbox();
    }
  }

  closeLightbox() {
    this.lightboxClose.emit();
  }
}
