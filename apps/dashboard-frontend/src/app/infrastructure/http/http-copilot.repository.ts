import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CopilotRequest, CopilotResponse } from '@rebecca/types';
import { CopilotRepository } from '../../core/ports/copilot.repository';

import { environment } from '../../../environments/environment';

/**
 * Infrastructure implementation of the CopilotRepository port using HttpClient.
 */
@Injectable({
  providedIn: 'root'
})
export class HttpCopilotRepository implements CopilotRepository {
  private http = inject(HttpClient);
  private baseUrl = ((environment as Record<string, unknown>)['apiUrl'] as string) || 'http://localhost:8081/api/v1';

  chat(request: CopilotRequest): Observable<CopilotResponse> {
    return this.http.post<CopilotResponse>(`${this.baseUrl}/copilot/chat`, request);
  }
}
