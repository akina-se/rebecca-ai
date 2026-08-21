import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { MemoryLayer, MemoryContent } from '@rebecca/types';

export interface MemoryRepository {
  getLayers(): Observable<MemoryLayer[]>;
  getCoreMemory(): Observable<MemoryContent>;
  getExtendedMemory(): Observable<MemoryContent>;
  updateExtendedMemory(content: string): Observable<unknown>;
  getGlobalMemory(): Observable<MemoryContent>;
  updateGlobalMemory(content: string): Observable<unknown>;
  triggerDreaming(): Observable<unknown>;
}

export const MEMORY_REPOSITORY = new InjectionToken<MemoryRepository>('MemoryRepository');
