import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActionHelperService } from './action-helper.service';
import { ToastService } from './toast.service';

describe('ActionHelperService', () => {
  let service: ActionHelperService;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['show']);

    TestBed.configureTestingModule({
      providers: [
        ActionHelperService,
        { provide: ToastService, useValue: toastServiceSpy }
      ]
    });

    service = TestBed.inject(ActionHelperService);
  });

  it('should execute mock action with default delay', fakeAsync(() => {
    let completed = false;
    service.executeMockAction('Success action').then(() => {
      completed = true;
    });

    expect(completed).toBeFalse();
    tick(2000);
    expect(completed).toBeTrue();
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Success action', 'success');
  }));

  it('should execute mock action with custom delay', fakeAsync(() => {
    let completed = false;
    service.executeMockAction('Custom action', 500).then(() => {
      completed = true;
    });

    expect(completed).toBeFalse();
    tick(500);
    expect(completed).toBeTrue();
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Custom action', 'success');
  }));
});
