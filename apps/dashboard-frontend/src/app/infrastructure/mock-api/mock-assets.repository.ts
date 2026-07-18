import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AssetsRepository } from '../../core/ports/assets.repository';
import { Asset } from '@rebecca/types';

@Injectable({
  providedIn: 'root'
})
export class MockAssetsRepository implements AssetsRepository {
  private assets: Asset[] = [
    {
      id: '1',
      filename: 'rebecca_summer_01.png',
      caption: 'レベッカが海辺で浮き輪を持っているイラスト。笑顔で楽しそうな表情。',
      usedCount: 3,
      status: 'SUCCESS'
    },
    {
      id: '2',
      filename: 'beach_bg_02.jpg',
      caption: '',
      usedCount: 0,
      status: 'FAILED'
    },
    {
      id: '3',
      filename: 'character_rebecca_idle.png',
      caption: '立ち絵用のレベッカの全身像。制服を着用している。',
      usedCount: 15,
      status: 'SUCCESS'
    }
  ];

  getAll(params?: { limit?: number; startAfterId?: string; search?: string; status?: string; }): Observable<Asset[]> {
    let filtered = [...this.assets];
    if (params) {
      if (params.search) {
        const query = params.search.toLowerCase();
        filtered = filtered.filter(a => a.filename.toLowerCase().includes(query) || a.caption.toLowerCase().includes(query));
      }
      if (params.status) {
        filtered = filtered.filter(a => a.status === params.status);
      }
      if (params.limit) {
        filtered = filtered.slice(0, params.limit);
      }
    }
    return of(filtered);
  }

  upload(file: File): Observable<any> {
    const newAsset: Asset = {
      id: String(this.assets.length + 1),
      filename: file.name,
      caption: 'AI-generated caption for ' + file.name,
      usedCount: 0,
      status: 'SUCCESS'
    };
    this.assets.push(newAsset);
    return of({ success: true, asset: newAsset });
  }

  update(id: string, updates: Partial<Asset>): Observable<any> {
    const idx = this.assets.findIndex(a => a.id === id);
    if (idx !== -1) {
      this.assets[idx] = { ...this.assets[idx], ...updates };
    }
    return of({ success: true });
  }

  deleteMany(ids: string[]): Observable<any> {
    this.assets = this.assets.filter(a => !ids.includes(a.id));
    return of({ success: true });
  }

  regenerateCaptions(ids: string[]): Observable<any> {
    this.assets.forEach(a => {
      if (ids.includes(a.id)) {
        a.caption = 'Regenerated Japanese caption for ' + a.filename;
        a.status = 'SUCCESS';
      }
    });
    return of({ success: true });
  }
}
