import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MemoryRepository } from '../../core/ports/memory.repository';
import { MemoryLayer, MemoryContent } from '@rebecca/types';
import { environment } from '../../../environments/environment';

/**
 * Repository implementation that makes real HTTP requests to the system memory BFF endpoints.
 */
@Injectable({
  providedIn: 'root'
})
export class HttpMemoryRepository implements MemoryRepository {
  private http = inject(HttpClient);
  private baseUrl = ((environment as Record<string, unknown>)['apiUrl'] as string) || 'http://localhost:8081/api/v1';

  /**
   * Fetches the hierarchy of memory layers from the backend.
   * 
   * @returns Observable of memory layers.
   */
  getLayers(): Observable<MemoryLayer[]> {
    return this.http.get<MemoryLayer[]>(`${this.baseUrl}/memory/layers`);
  }

  /**
   * Fetches the core AI memory from the backend.
   * 
   * @returns Observable of core memory content.
   */
  getCoreMemory(): Observable<MemoryContent> {
    return this.http.get<MemoryContent>(`${this.baseUrl}/memory/core`);
  }

  /**
   * Fetches the global personality memory from the backend.
   * 
   * @returns Observable of global memory content.
   */
  getGlobalMemory(): Observable<MemoryContent> {
    return this.http.get<MemoryContent>(`${this.baseUrl}/memory/global`);
  }

  /**
   * Updates the global personality memory content on the backend.
   * 
   * @param content - The new text content.
   * @returns Observable resolving when update completes.
   */
  updateGlobalMemory(content: string): Observable<unknown> {
    return this.http.put<unknown>(`${this.baseUrl}/memory/global`, { content });
  }

  /**
   * Triggers the Force Dreaming batch job on the backend.
   * 
   * @returns Observable resolving when dreaming completes.
   */
  triggerDreaming(): Observable<unknown> {
    return this.http.post<unknown>(`${this.baseUrl}/memory/force-dreaming`, {});
  }
}
