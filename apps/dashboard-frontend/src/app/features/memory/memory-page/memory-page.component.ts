import { Component, OnInit, inject, signal } from '@angular/core';

import { ToastService } from '../../../shared/services/toast.service';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { MemoryDrawerComponent } from '../../../shared/components/organisms/memory-drawer/memory-drawer.component';
import { TzDatePipe } from '../../../shared/pipes/tz-date.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { MEMORY_REPOSITORY } from '../../../core/ports/memory.repository';
import { MemoryLayer } from '@rebecca/types';

@Component({
  selector: 'app-memory-page',
  standalone: true,
  imports: [RightDrawerComponent, MemoryDrawerComponent, TzDatePipe, TranslatePipe],
  templateUrl: './memory-page.component.html',
  styleUrls: ['./memory-page.component.css']
})
export class MemoryPageComponent implements OnInit {
  toastService = inject(ToastService);
  translationService = inject(TranslationService);
  isDreaming = false;
  readonly isLoading = signal<boolean>(false);
  
  readonly isDrawerOpen = signal<boolean>(false);
  readonly drawerLevel = signal<number>(0);
  readonly drawerTitle = signal<string>('');
  readonly drawerIcon = signal<string>('dns');

  readonly layers = signal<MemoryLayer[]>([]);
  private readonly memoryRepo = inject(MEMORY_REPOSITORY);

  ngOnInit() {
    this.loadLayers();
  }

  loadLayers() {
    this.isLoading.set(true);
    this.memoryRepo.getLayers().subscribe({
      next: (layers) => {
        this.layers.set(layers || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.show('Failed to load memory layers', 'error');
        this.isLoading.set(false);
      }
    });
  }

  openDrawer(level: number) {
    this.drawerLevel.set(level);
    this.drawerTitle.set(`Layer ${level}: ${this.translationService.t(`memory.layer${level}_name`)}`);
    this.drawerIcon.set(this.getIconForLayer(level));
    this.isDrawerOpen.set(true);
  }

  async forceDreaming() {
    if (this.isDreaming) return;
    
    this.isDreaming = true;
    this.memoryRepo.triggerDreaming().subscribe({
      next: () => {
        this.toastService.show('Force Dreaming completed successfully. Memory aligned.', 'success');
        this.isDreaming = false;
        this.loadLayers();
      },
      error: () => {
        this.toastService.show('Force Dreaming failed.', 'error');
        this.isDreaming = false;
      }
    });
  }

  formatDate(iso: string | null): string {
    if (!iso) return 'System Deploy';
    const parsed = new Date(iso);
    if (isNaN(parsed.getTime())) {
      return iso;
    }
    return parsed.toLocaleString('ja-JP', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  getIconForLayer(level: number): string {
    if (level === 0) return 'dns';
    if (level === 1) return 'tune';
    return 'public';
  }
}
