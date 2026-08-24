import { Component, Input, Output, EventEmitter, inject, OnChanges, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawerService } from '../../../../core/services/drawer.service';
import { ToastService } from '../../../services/toast.service';
import { DASHBOARD_REPOSITORY, DashboardRepository } from '../../../../core/ports/dashboard.repository';
import { CopilotContextService } from '../../../../core/services/copilot-context.service';
import { TzDatePipe } from '../../../pipes/tz-date.pipe';
import { TranslatePipe } from '../../../pipes/translate.pipe';

interface PostDataModel {
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
  imports: [CommonModule, TzDatePipe, TranslatePipe],
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
  isLoading = false;

  postData: PostDataModel | null = null;
  private readonly dashboardRepo = inject(DASHBOARD_REPOSITORY);

  ngOnChanges() {
    if (this.postId) {
      this.loadPost(this.postId);
    }
  }

  loadPost(id: string) {
    this.isLoading = true;
    this.dashboardRepo.getPostById(id).subscribe({
      next: (post) => {
        const postData = {
          id: post.id,
          time: post.time,
          text: post.content || '',
          impressions: post.impressions?.toString() || '0',
          status: String(post.status || 'SUCCESS'),
          likes: post.likes || 0,
          retweets: post.retweets || 0,
          replies: post.replies || 0,
          mediaUrls: post.mediaUrls || []
        };
        this.postData = postData;
        this.contextService.setFocusedEntity({
          type: 'post',
          id: post.id,
          label: postData.text.slice(0, 35),
          details: { impressions: postData.impressions, status: postData.status }
        });
        this.isLoading = false;
      },
      error: () => {
        this.toastService.show('Failed to load post details', 'error');
        this.isLoading = false;
      }
    });
  }

  onOpenLightbox(url: string) {
    this.openLightbox.emit(url);
  }

  onDeletePost() {
    if (!this.postData) return;
    this.isDeleting = true;
    this.dashboardRepo.deletePosts([this.postData.id]).subscribe({
      next: () => {
        this.toastService.show(`Successfully deleted post`, 'success');
        this.isDeleting = false;
        this.drawerService.close(); // Close drawer after delete
        // We might want to reload the timeline here, but the dashboard page does that
        // However, we don't have an EventEmitter for that in this component, but the UI should reflect it.
        // E2E test will check if it's gone after reload or via DB
      },
      error: () => {
        this.toastService.show(`Failed to delete post`, 'error');
        this.isDeleting = false;
      }
    });
  }

  onViewOnX(): void {
    const tweetId = this.postData?.id || this.postId;
    if (!tweetId) return;
    const url = `https://x.com/i/status/${tweetId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openAiCopilot() {
    this.drawerService.open();
  }
}

