import { Component, Input, Output, EventEmitter, inject, OnChanges, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawerService } from '../../../../core/services/drawer.service';
import { ToastService } from '../../../services/toast.service';
import { DASHBOARD_REPOSITORY, DashboardRepository } from '../../../../core/ports/dashboard.repository';
import { TzDatePipe } from '../../../pipes/tz-date.pipe';

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
  imports: [CommonModule, TzDatePipe],
  templateUrl: './post-drawer.component.html',
  styleUrls: ['./post-drawer.component.css']
})
export class PostDrawerComponent implements OnChanges {
  drawerService = inject(DrawerService);
  toastService = inject(ToastService);
  @Input() postId: string | null = null;
  @Output() openLightbox = new EventEmitter<string>();

  isDeleting = false;
  isLoading = false;

  postData: PostDataModel | null = null;

  constructor(@Inject(DASHBOARD_REPOSITORY) private dashboardRepo: DashboardRepository) {}

  ngOnChanges() {
    if (this.postId) {
      this.loadPost(this.postId);
    }
  }

  loadPost(id: string) {
    this.isLoading = true;
    this.dashboardRepo.getPostById(id).subscribe({
      next: (post) => {
        // Fallback for missing properties not returned by MVP backend
        this.postData = {
          id: post.id,
          time: post.time,
          text: post.content || post.text || '',
          impressions: post.impressions?.toString() || '0',
          status: post.status || 'SUCCESS',
          likes: post.likes || 0,
          retweets: post.retweets || 0,
          replies: post.replies || 0,
          mediaUrls: post.mediaUrls || []
        };
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

