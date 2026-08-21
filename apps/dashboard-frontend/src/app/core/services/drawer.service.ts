import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Service for managing the visibility state of the application's drawer/sidebar.
 */
@Injectable({
  providedIn: 'root'
})
export class DrawerService {
  private isOpenSubject = new BehaviorSubject<boolean>(false);
  isOpen$ = this.isOpenSubject.asObservable();

  /**
   * Toggles the current visibility state of the drawer.
   */
  toggle() {
    this.isOpenSubject.next(!this.isOpenSubject.value);
  }

  /**
   * Closes the drawer by setting its visibility state to false.
   */
  close() {
    this.isOpenSubject.next(false);
  }

  /**
   * Opens the drawer by setting its visibility state to true.
   */
  open() {
    this.isOpenSubject.next(true);
  }
}
