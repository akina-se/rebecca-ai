import { Injectable } from '@angular/core';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root'
})
export class ActionHelperService {
  constructor(private toastService: ToastService) {}

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
