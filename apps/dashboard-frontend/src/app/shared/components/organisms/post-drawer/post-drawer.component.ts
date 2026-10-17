import { Component, Input, Output, EventEmitter, inject, OnChanges, signal } from '@angular/core';
import { PollData } from '@rebecca/types';

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
  reposts: number;
  replies: number;
  mediaUrls: string[];
  poll?: PollData;
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
        const postData: PostDataModel = {
          id: post.id,
          tweetId: post.tweetId,
          time: post.time,
          text: post.content || '',
          thought: post.thought,
          impressions: post.impressions?.toString() || '0',
          status: String(post.status || 'SUCCESS'),
          likes: post.likes || 0,
          reposts: post.reposts || 0,
          replies: post.replies || 0,
          mediaUrls: post.mediaUrls || [],
          ...(post.poll ? { poll: post.poll } : {}),
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

  /**
   * Computes the total number of votes cast across all options of the active poll.
   *
   * @returns Total vote count, or `0` if the post has no poll options.
   */
  getTotalPollVotes(): number {
    const options = this.postData()?.poll?.options;
    if (!options || options.length === 0) return 0;
    return options.reduce((sum, opt) => sum + (Number(opt.votes) || 0), 0);
  }

  /**
   * Calculates the vote share percentage for a single poll option rounded to 1 decimal place.
   *
   * @param votes - Number of votes received by the option.
   * @returns Percentage in the range `[0, 100]`.
   */
  getPollOptionPercentage(votes: number): number {
    const total = this.getTotalPollVotes();
    if (total <= 0) return 0;
    return Math.round(((Number(votes) || 0) / total) * 1000) / 10;
  }

  /**
   * Determines whether a poll option has the highest vote count (including ties for first place)
   * when at least one vote has been cast.
   *
   * @param votes - Number of votes received by the option.
   * @returns `true` if the option is a top-voted choice with > 0 votes.
   */
  isLeadingPollOption(votes: number): boolean {
    const options = this.postData()?.poll?.options;
    if (!options || options.length === 0) return false;
    const maxVotes = Math.max(...options.map((opt) => Number(opt.votes) || 0));
    return maxVotes > 0 && (Number(votes) || 0) === maxVotes;
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
