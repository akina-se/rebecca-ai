import { TestBed } from '@angular/core/testing';
import { ActionHelperService } from './action-helper.service';
import { ToastService } from './toast.service';

describe('ActionHelperService', () => {
  let service: ActionHelperService;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    jest.useFakeTimers();
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['show']);

    TestBed.configureTestingModule({
      providers: [
        ActionHelperService,
        { provide: ToastService, useValue: toastServiceSpy }
      ]
    });

    service = TestBed.inject(ActionHelperService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should execute mock action with default delay', async () => {
    let completed = false;
    const promise = service.executeMockAction('Success action').then(() => {
      completed = true;
    });

    expect(completed).toBe(false);
    jest.advanceTimersByTime(2000);
    await promise;
    expect(completed).toBe(true);
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Success action', 'success');
  });

  it('should execute mock action with custom delay', async () => {
    let completed = false;
    const promise = service.executeMockAction('Custom action', 500).then(() => {
      completed = true;
    });

    expect(completed).toBe(false);
    jest.advanceTimersByTime(500);
    await promise;
    expect(completed).toBe(true);
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Custom action', 'success');
  });
});
