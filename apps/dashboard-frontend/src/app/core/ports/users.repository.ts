import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { UserDetail, UserStatus, PaginatedResponse } from '@rebecca/types';

export interface UsersRepository {
  getAll(): Observable<PaginatedResponse<UserDetail>>;
  getById(id: string, beforeTimestamp?: string, limit?: number): Observable<UserDetail>;
  updateMemory(id: string, coreProfile: string): Observable<unknown>;
  bulkUpdateStatus(ids: string[], status: UserStatus): Observable<unknown>;
}

export const USERS_REPOSITORY = new InjectionToken<UsersRepository>('UsersRepository');
