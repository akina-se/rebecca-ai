import { Component, Input, Output, EventEmitter, inject, OnChanges, signal } from '@angular/core';

import { DrawerService } from '../../../../core/services/drawer.service';
import { ToastService } from '../../../services/toast.service';
import { DASHBOARD_REPOSITORY } from '../../../../core/ports/dashboard.repository';
import { CopilotContextService } from '../../../../core/services/copilot-context.service';
import { TzDatePipe } from '../../../pipes/tz-date.pipe';
import { TranslatePipe } from '../../../pipes/translate.pipe';

interface PostDataModel {
  id: string;
  tweetId?: string;
  time: string;
  text: string;
  thought?: string;
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
  imports: [TzDatePipe, TranslatePipe],
  templateUrl: './post-drawer.component.html',
  styleUrls: ['./post-drawer.component.css']
})
export class PostDrawerComponent implements OnChanges {
  drawerService = inject(DrawerService);
  toastService = inject(ToastService);
  contextService = inject(CopilotContextService);

  @Input() postId: string | null = null;
  @Output() openLightbox = new EventEmitter<string>();

  isDeleting = false;
  readonly isLoading = signal<boolean>(false);

  readonly postData = signal<PostDataModel | null>(null);
  private readonly dashboardRepo = inject(DASHBOARD_REPOSITORY);

  ngOnChanges() {
    if (this.postId) {
      this.loadPost(this.postId);
    }
  }

  loadPost(id: string) {
    this.isLoading.set(true);
    this.dashboardRepo.getPostById(id).subscribe({
      next: (post) => {
        const postData = {
          id: post.id,
          tweetId: post.tweetId,
          time: post.time,
          text: post.content || '',
          thought: post.thought,
          impressions: post.impressions?.toString() || '0',
          status: String(post.status || 'SUCCESS'),
          likes: post.likes || 0,
          retweets: post.retweets || 0,
          replies: post.replies || 0,
          mediaUrls: post.mediaUrls || []
        };
        this.postData.set(postData);

        this.contextService.setFocusedEntity({
          type: 'post',
          id: post.id,
          label: post.content?.slice(0, 30) || post.id,
          details: { impressions: post.impressions, status: post.status }
        });

        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.show('Failed to load post details', 'error');
        this.isLoading.set(false);
      }
    });
  }

  get displayPost(): PostDataModel | null {
    return this.postData();
  }

  onMediaClick(url: string): void {
    this.openLightbox.emit(url);
  }

  onDelete(): void {
    const data = this.postData();
    if (!data) return;

    this.isDeleting = true;
    this.dashboardRepo.deletePosts([data.id]).subscribe({
      next: () => {
        this.toastService.show('Post deleted successfully', 'success');
        this.isDeleting = false;
      },
      error: () => {
        this.toastService.show('Failed to delete post', 'error');
        this.isDeleting = false;
      }
    });
  }

  onViewOnX(): void {
    const tweetId = this.postData()?.tweetId;
    if (!tweetId) {
      this.toastService.show('Tweet ID is not available for this post', 'info');
      return;
    }
    const url = `https://x.com/i/status/${tweetId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
