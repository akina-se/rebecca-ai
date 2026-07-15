import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-post-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './post-drawer.component.html',
  styleUrls: ['./post-drawer.component.css']
})
export class PostDrawerComponent {
  @Input() postId: string | null = null;
  @Output() openLightbox = new EventEmitter<string>();

  isDeleting = false;

  // Mock data with media
  mockPost = {
    id: '123',
    time: '2026-07-11 12:00:00',
    text: '今日は暑いね！水分補給しっかりしてね🥤',
    impressions: '3,402',
    status: 'Success',
    likes: 120,
    retweets: 15,
    replies: 8,
    // Mock media images - in production these come from the API
    mediaUrls: [
      'https://picsum.photos/seed/post1a/600/400',
      'https://picsum.photos/seed/post1b/600/400',
    ]
  };

  onOpenLightbox(url: string) {
    this.openLightbox.emit(url);
  }

  onDeletePost() {
    this.isDeleting = true;
    // Simulate API call
    setTimeout(() => {
      this.isDeleting = false;
    }, 2000);
  }
}
