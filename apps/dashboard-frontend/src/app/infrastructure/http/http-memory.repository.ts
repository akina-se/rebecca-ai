import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MemoryRepository } from '../../core/ports/memory.repository';
import { MemoryLayer, MemoryContent } from '@rebecca/types';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class HttpMemoryRepository implements MemoryRepository {
  private http = inject(HttpClient);
  private baseUrl = (environment as any).apiUrl || 'http://localhost:8081/api/v1/dashboard';

  getLayers(): Observable<MemoryLayer[]> {
    return this.http.get<MemoryLayer[]>(`${this.baseUrl}/memory/layers`);
  }

  getCoreMemory(): Observable<MemoryContent> {
    return this.http.get<MemoryContent>(`${this.baseUrl}/memory/core`);
  }

  getGlobalMemory(): Observable<MemoryContent> {
    return this.http.get<MemoryContent>(`${this.baseUrl}/memory/global`);
  }

  updateGlobalMemory(content: string): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/memory/global`, { content });
  }

  triggerDreaming(): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/memory/force-dreaming`, {});
  }
}
