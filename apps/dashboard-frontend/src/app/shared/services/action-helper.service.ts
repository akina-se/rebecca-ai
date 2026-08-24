import { Injectable, inject } from '@angular/core';
import { ToastService } from './toast.service';

/**
 * A helper service to simulate generic actions and provide user feedback via toasts.
 * Useful for mocking features during development.
 */
@Injectable({
  providedIn: 'root'
})
export class ActionHelperService {
  private readonly toastService = inject(ToastService);

  /**
   * Executes a mock action with an artificial delay, displaying a success toast upon completion.
   *
   * @param {string} successMessage - The message to display when the mock action completes.
   * @param {number} [delayMs=2000] - The delay in milliseconds before completing the action.
   * @returns {Promise<void>} A promise that resolves after the specified delay.
   */
  async executeMockAction(
    successMessage: string, 
    delayMs = 2000
  ): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        this.toastService.show(successMessage, 'success');
        resolve();
      }, delayMs);
    });
  }
}
