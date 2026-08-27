import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserDrawerComponent } from './user-drawer.component';
import { USERS_REPOSITORY, UsersRepository } from '../../../../core/ports/users.repository';
import { ToastService } from '../../../services/toast.service';
import { of, throwError } from 'rxjs';
import { UserDetail, UserStatus } from '@rebecca/types';
import { DrawerService } from '../../../../core/services/drawer.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('UserDrawerComponent (White-box Coverage)', () => {
  let component: UserDrawerComponent;
  let fixture: ComponentFixture<UserDrawerComponent>;
  let mockUsersRepo: jasmine.SpyObj<UsersRepository>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  const mockUserDetail: UserDetail = {
    id: 'user_123',
    username: 'alice_gal',
    name: 'Alice',
    status: UserStatus.ACTIVE,
    interactions: 140,
    firstSeen: '2026-01-01',
    lastSeen: '2026-07-22',
    coreProfile: JSON.stringify({
      attributes: ['Gyaru lover', 'Anime fan'],
      preferences: ['Late night anime'],
      concerns: [],
      important_memories: []
    }),
    chatHistory: []
  };

  beforeEach(async () => {
    mockUsersRepo = jasmine.createSpyObj('UsersRepository', ['getById', 'bulkUpdateStatus', 'updateMemory']);
    mockToastService = jasmine.createSpyObj('ToastService', ['show']);

    mockUsersRepo.getById.and.callFake(() => of({ ...mockUserDetail }));
    mockUsersRepo.bulkUpdateStatus.and.returnValue(of(void 0));
    mockUsersRepo.updateMemory.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [UserDrawerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DrawerService,
        { provide: USERS_REPOSITORY, useValue: mockUsersRepo },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserDrawerComponent);
    component = fixture.componentInstance;
    component.userId = 'user_123';
    component.ngOnChanges();
    fixture.detectChanges();
  });

  it('should load user details and parse coreProfile JSON correctly', () => {
    expect(mockUsersRepo.getById).toHaveBeenCalledWith('user_123');
    expect(component.user()).toEqual(mockUserDetail);
    expect(component.isBlocked()).toBeFalse();
    expect(component.parsedProfile()['attributes']).toContain('Gyaru lover');
  });

  it('should handle fetch user error gracefully', () => {
    mockUsersRepo.getById.and.returnValue(throwError(() => new Error('Not found')));
    component.userId = 'err_user';
    component.ngOnChanges();
    expect(component.userId).toBe('err_user');
  });

  it('should handle malformed coreProfile JSON gracefully', () => {
    const malformedUser = { ...mockUserDetail, coreProfile: 'INVALID_JSON{[' };
    mockUsersRepo.getById.and.returnValue(of(malformedUser));

    component.userId = 'user_123';
    component.ngOnChanges();

    expect(component.parsedProfile()['attributes']).toEqual([]);
  });

  it('should add and remove tags from profile categories', () => {
    const input = document.createElement('input');
    input.value = 'Gamer';
    const fakeEvent = { target: input } as unknown as Event;

    component.addTag('preferences', fakeEvent);
    expect(component.parsedProfile()['preferences']).toContain('Gamer');

    // Empty tag input
    input.value = '   ';
    component.addTag('preferences', fakeEvent);

    component.removeTag('preferences', 0);
    expect(component.parsedProfile()['preferences']).not.toContain('Late night anime');
  });

  it('should toggle user status between Active and Blocked', () => {
    component.onBlockUser();
    expect(mockUsersRepo.bulkUpdateStatus).toHaveBeenCalledWith(['user_123'], UserStatus.BLOCKED);
    expect(mockToastService.show).toHaveBeenCalledWith(jasmine.stringMatching(/blocked/i), 'success');

    // Unblock branch
    component.isBlocked.set(true);
    component.onBlockUser();
    expect(mockUsersRepo.bulkUpdateStatus).toHaveBeenCalledWith(['user_123'], UserStatus.ACTIVE);
  });

  it('should handle block user error', () => {
    mockUsersRepo.bulkUpdateStatus.and.returnValue(throwError(() => new Error('Err')));
    component.onBlockUser();
    expect(component.isActionLoading()).toBeFalse();
  });

  it('should format JSON and save updated core profile and handle error', () => {
    component.onSaveProfile();
    const expectedJson = JSON.stringify(component.parsedProfile(), null, 2);
    expect(mockUsersRepo.updateMemory).toHaveBeenCalledWith('user_123', expectedJson);
    expect(mockToastService.show).toHaveBeenCalledWith(jasmine.stringMatching(/saved core profile/i), 'success');

    // Error branch
    mockUsersRepo.updateMemory.and.returnValue(throwError(() => new Error('Err')));
    component.onSaveProfile();
    expect(component.isSavingProfile()).toBeFalse();
  });

  it('should open user profile on X via window.open and handle empty handle', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    component.onViewOnX();
    expect(openSpy).toHaveBeenCalledWith('https://x.com/alice_gal', '_blank', 'noopener,noreferrer');

    component.user.set(undefined);
    component.userId = null;
    component.onViewOnX();
    expect(openSpy).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();
  });

  it('should handle empty userId on lifecycle changes and early exits', () => {
    component.userId = null;
    component.ngOnChanges();
    expect(component.user()).toBeDefined(); // preserved previous state

    component.user.set(undefined);
    component.userId = null;
    component.onBlockUser();
    component.onSaveProfile();
    expect(component.isActionLoading()).toBeFalse();
    expect(component.isSavingProfile()).toBeFalse();
  });

  it('should set context label with fallback to name and ID when username is missing', () => {
    const userWithoutUsername = {
      ...mockUserDetail,
      username: '',
      name: 'Alice Only'
    };
    mockUsersRepo.getById.and.returnValue(of(userWithoutUsername));
    component.userId = 'user_no_uname';
    component.ngOnChanges();
    expect(component.user()?.name).toBe('Alice Only');

    const userWithIdOnly = {
      ...mockUserDetail,
      username: '',
      name: ''
    };
    mockUsersRepo.getById.and.returnValue(of(userWithIdOnly));
    component.userId = 'user_id_only';
    component.ngOnChanges();
    expect(component.user()?.id).toBe('user_123');
  });
});
