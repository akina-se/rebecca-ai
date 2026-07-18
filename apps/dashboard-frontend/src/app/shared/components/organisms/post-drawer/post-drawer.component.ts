import { Component, Input, Output, EventEmitter, inject, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawerService } from '../../../../core/services/drawer.service';
import { ActionHelperService } from '../../../services/action-helper.service';

interface PostMockModel {
  id: string;
  time: string;
  text: string;
  impressions: string;
  status: string;
  likes: number;
  retweets: number;
  replies: number;
  mediaUrls: string[];
}

@Component({
  selector: 'app-post-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './post-drawer.component.html',
  styleUrls: ['./post-drawer.component.css']
})
export class PostDrawerComponent implements OnChanges {
  drawerService = inject(DrawerService);
  @Input() postId: string | null = null;
  @Output() openLightbox = new EventEmitter<string>();

  isDeleting = false;

  mockPost: PostMockModel = { id: '', time: '', text: '', impressions: '', status: '', likes: 0, retweets: 0, replies: 0, mediaUrls: [] };

  ngOnChanges() {
    if (this.postId === '1') {
      this.mockPost = {
        id: '1', time: '2026-07-11 12:00', text: '今日は暑いね！水分補給しっかりしてね', impressions: '3,402', status: 'Success', likes: 120, retweets: 15, replies: 8, mediaUrls: ['https://picsum.photos/seed/post1a/600/400', 'https://picsum.photos/seed/post1b/600/400']
      };
    } else if (this.postId === 'p1') {
      this.mockPost = {
        id: 'p1', time: '2026-07-10 18:00', text: '水星の魔女、最新話見た！？展開が熱すぎる…', impressions: '5,120', status: 'Success', likes: 450, retweets: 120, replies: 35, mediaUrls: ['https://picsum.photos/seed/post2a/600/400']
      };
    } else if (this.postId === 'p2') {
      this.mockPost = {
        id: 'p2', time: '2026-07-09 08:00', text: 'おはよう！今日も1日頑張ろうね', impressions: '4,800', status: 'Success', likes: 300, retweets: 50, replies: 12, mediaUrls: []
      };
    } else if (this.postId === 'p3') {
      this.mockPost = {
        id: 'p3', time: '2026-07-08 12:00', text: '夏コミ行く人いるー？', impressions: '3,950', status: 'Success', likes: 250, retweets: 40, replies: 15, mediaUrls: ['https://picsum.photos/seed/post3/600/400']
      };
    } else {
      this.mockPost = {
        id: this.postId || '123', time: '2026-07-11 12:00', text: '今日は暑いね！水分補給しっかりしてね', impressions: '3,402', status: 'Success', likes: 120, retweets: 15, replies: 8, mediaUrls: ['https://picsum.photos/seed/post1a/600/400']
      };
    }
  }

  onOpenLightbox(url: string) {
    this.openLightbox.emit(url);
  }

  actionHelper = inject(ActionHelperService);

  async onDeletePost() {
    this.isDeleting = true;
    await this.actionHelper.executeMockAction(`Successfully deleted post ${this.mockPost.id}`);
    this.isDeleting = false;
  }

  openAiCopilot() {
    this.drawerService.open();
  }
}
