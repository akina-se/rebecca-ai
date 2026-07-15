import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  icon: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<Toast[]>([]);
  private idCounter = 0;

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

  remove(id: number) {
    this.toasts.update(t => t.filter(toast => toast.id !== id));
  }

  constructor() { }
}
