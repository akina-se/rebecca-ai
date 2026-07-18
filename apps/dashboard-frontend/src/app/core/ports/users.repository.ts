import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { UserDetail } from '@rebecca/types';

export interface UsersRepository {
  getAll(): Observable<UserDetail[]>;
  getById(id: string, beforeTimestamp?: string, limit?: number): Observable<UserDetail>;
  updateMemory(id: string, coreProfile: string): Observable<any>;
  bulkUpdateStatus(ids: string[], status: string): Observable<any>;
}

export const USERS_REPOSITORY = new InjectionToken<UsersRepository>('UsersRepository');
