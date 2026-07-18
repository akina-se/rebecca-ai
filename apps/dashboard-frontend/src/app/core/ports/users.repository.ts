import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { UserDetail } from '@rebecca/types';

export interface UsersRepository {
  getAll(): Observable<UserDetail[]>;
  getById(id: string, beforeTimestamp?: string, limit?: number): Observable<UserDetail>;
  updateMemory(id: string, coreProfile: string): Observable<unknown>;
  bulkUpdateStatus(ids: string[], status: string): Observable<unknown>;
}

export const USERS_REPOSITORY = new InjectionToken<UsersRepository>('UsersRepository');
