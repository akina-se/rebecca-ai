import { Component, OnInit, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../shared/services/toast.service';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { MemoryDrawerComponent } from '../../../shared/components/organisms/memory-drawer/memory-drawer.component';
import { TzDatePipe } from '../../../shared/pipes/tz-date.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { MEMORY_REPOSITORY, MemoryRepository } from '../../../core/ports/memory.repository';
import { MemoryLayer } from '@rebecca/types';

@Component({
  selector: 'app-memory-page',
  standalone: true,
  imports: [CommonModule, RightDrawerComponent, MemoryDrawerComponent, TzDatePipe, TranslatePipe],
  templateUrl: './memory-page.component.html',
  styleUrls: ['./memory-page.component.css']
})
export class MemoryPageComponent implements OnInit {
  toastService = inject(ToastService);
  translationService = inject(TranslationService);
  isDreaming = false;
  isLoading = false;
  
  isDrawerOpen = false;
  drawerLevel = 0;
  drawerTitle = '';
  drawerIcon = 'dns';

  layers: MemoryLayer[] = [];

  constructor(@Inject(MEMORY_REPOSITORY) private memoryRepo: MemoryRepository) {}

  ngOnInit() {
    this.loadLayers();
  }

  loadLayers() {
    this.isLoading = true;
    this.memoryRepo.getLayers().subscribe({
      next: (layers) => {
        this.layers = layers;
        this.isLoading = false;
      },
      error: () => {
        this.toastService.show('Failed to load memory layers', 'error');
        this.isLoading = false;
      }
    });
  }

  openDrawer(level: number) {
    this.drawerLevel = level;
    this.drawerTitle = this.translationService.t(`memory.layer${level}_name`);
    this.drawerIcon = this.getIconForLayer(level);
    this.isDrawerOpen = true;
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
