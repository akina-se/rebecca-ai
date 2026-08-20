import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CopilotRequest, CopilotResponse } from '@rebecca/types';

/**
 * Injection token for the Copilot repository.
 */
export const COPILOT_REPOSITORY = new InjectionToken<CopilotRepository>('COPILOT_REPOSITORY');

/**
 * Port interface defining Copilot chat and AI assistant operations.
 */
export interface CopilotRepository {
  /**
   * Sends a message and context to Rebecca AI Copilot.
   * 
   * @param request - The copilot request payload.
   * @returns Observable emitting structured CopilotResponse.
   */
  chat(request: CopilotRequest): Observable<CopilotResponse>;
}
