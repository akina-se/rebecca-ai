import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ToastService]
    });
    service = TestBed.inject(ToastService);
  });

  it('should add a toast and assign proper icon by type', () => {
    service.show('Operation successful', 'success');

    const toasts = service.toasts();
    expect(toasts.length).toBe(1);
    expect(toasts[0].message).toBe('Operation successful');
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].icon).toBe('check_circle');
  });

  it('should auto-remove toast after timeout', () => {
    jest.useFakeTimers();
    try {
      service.show('Temporary notification', 'info');
      expect(service.toasts().length).toBe(1);

      jest.advanceTimersByTime(4000);
      expect(service.toasts().length).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should remove a toast manually by ID', () => {
    service.show('Notification 1');
    service.show('Notification 2');

    const toasts = service.toasts();
    expect(toasts.length).toBe(2);

    const firstId = toasts[0].id;
    service.remove(firstId);

    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].id).not.toBe(firstId);
  });
});
