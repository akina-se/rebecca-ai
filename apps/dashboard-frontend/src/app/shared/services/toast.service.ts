import { Injectable, signal } from '@angular/core';

/**
 * Represents a toast notification.
 */
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  icon: string;
}

/**
 * Service responsible for managing and displaying toast notifications.
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<Toast[]>([]);
  private idCounter = 0;

  /**
   * Displays a new toast notification.
   *
   * @param {string} message - The message to display in the toast.
   * @param {'success' | 'error' | 'warning' | 'info'} [type='info'] - The type of toast to display.
   */
  show(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };
    
    const toast: Toast = {
      id: this.idCounter++,
      message,
      type,
      icon: icons[type]
    };

    this.toasts.update(t => [...t, toast]);

    setTimeout(() => {
      this.remove(toast.id);
    }, 4000);
  }

  /**
   * Removes a toast notification by its ID.
   *
   * @param {number} id - The unique identifier of the toast to remove.
   */
  remove(id: number) {
    this.toasts.update(t => t.filter(toast => toast.id !== id));
  }


}
