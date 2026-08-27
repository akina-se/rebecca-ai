import { Component, OnInit, inject, ElementRef, ViewChild, AfterViewChecked, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerService } from '../../core/services/drawer.service';
import { CopilotService } from '../../core/services/copilot.service';
import { CopilotContextService } from '../../core/services/copilot-context.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { CopilotAction } from '@rebecca/types';

/**
 * AI Copilot Drawer component providing persistent interactive chat,
 * route-aware context tracking, suggestion chips, and Two-Phase HITL safety action cards.
 */
@Component({
  selector: 'app-ai-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './ai-drawer.component.html',
  styleUrls: ['./ai-drawer.component.css']
})
export class AiDrawerComponent implements OnInit, AfterViewChecked {
  drawerService = inject(DrawerService);
  copilotService = inject(CopilotService);
  contextService = inject(CopilotContextService);

  @ViewChild('chatScroll') private chatScrollContainer?: ElementRef;

  readonly isOpen = signal<boolean>(false);
  inputMessage = '';
  private shouldScrollToBottom = false;

  ngOnInit() {
    this.drawerService.isOpen$.subscribe({
      next: (open: boolean) => {
        this.isOpen.set(open);
        if (open) {
          this.shouldScrollToBottom = true;
        }
      },
      error: (err: unknown) => console.error('AiDrawer drawerService error:', err)
    });
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  close() {
    this.drawerService.close();
  }

  onSendMessage() {
    const text = this.inputMessage.trim();
    if (!text || this.copilotService.isLoading()) return;
    this.copilotService.sendMessage(text);
    this.inputMessage = '';
    this.shouldScrollToBottom = true;
  }

  onChipClick(chipText: string) {
    if (this.copilotService.isLoading()) return;
    this.copilotService.sendMessage(chipText);
    this.shouldScrollToBottom = true;
  }

  onApproveAction(index: number, action: CopilotAction) {
    this.copilotService.approveAction(index, action);
    this.shouldScrollToBottom = true;
  }

  onCancelAction(index: number) {
    this.copilotService.cancelAction(index);
    this.shouldScrollToBottom = true;
  }

  onClearSession() {
    this.copilotService.clearHistory();
    this.shouldScrollToBottom = true;
  }

  private scrollToBottom(): void {
    try {
      if (this.chatScrollContainer) {
        this.chatScrollContainer.nativeElement.scrollTop = this.chatScrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.warn('Scroll to bottom failed:', err);
    }
  }
}
