import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { MemoryRepository } from '../../core/ports/memory.repository';
import { MemoryLayer, MemoryContent } from '@rebecca/types';

@Injectable({
  providedIn: 'root'
})
export class MockMemoryRepository implements MemoryRepository {
  private layers: MemoryLayer[] = [
    { level: 0, name: 'L0: Core Persona', description: 'Core prompts, rules, tone parameters, and primary identity definitions.', lastUpdated: '2026-07-16 14:32', isReadOnly: true },
    { level: 1, name: 'L1: Episodic Buffer', description: 'Recent conversation history logs, context windows, and temporary session state.', lastUpdated: '2026-07-18 04:12', isReadOnly: true },
    { level: 2, name: 'L2: Global RAG Context', description: 'Aggregated semantic memories, user interaction histories, and facts database.', lastUpdated: '2026-07-17 19:42', isReadOnly: false }
  ];

  private coreMemory: MemoryContent = {
    level: 0,
    name: 'L0: Core Persona',
    content: 'Rebecca is a cheerful high-school girl AI chatbot interested in gaming, anime, and programming. She speaks in friendly, informal Japanese.',
    isReadOnly: true
  };

  private globalMemory: MemoryContent = {
    level: 2,
    name: 'L2: Global RAG Context',
    content: 'Rebecca has met multiple friends, including Gundam Fan 88, Tech Geek, and Rebecca Oshi. She remembers their preferences and attributes for personalized interactions.',
    isReadOnly: false
  };

  getLayers(): Observable<MemoryLayer[]> {
    return of(this.layers);
  }

  getCoreMemory(): Observable<MemoryContent> {
    return of(this.coreMemory);
  }

  getGlobalMemory(): Observable<MemoryContent> {
    return of(this.globalMemory);
  }

  updateGlobalMemory(content: string): Observable<any> {
    this.globalMemory.content = content;
    const l2 = this.layers.find(l => l.level === 2);
    if (l2) {
      l2.lastUpdated = new Date().toISOString().replace('T', ' ').substring(0, 16);
    }
    return of({ success: true });
  }

  triggerDreaming(): Observable<any> {
    return of({ success: true, message: 'Dreaming process initiated' });
  }
}
