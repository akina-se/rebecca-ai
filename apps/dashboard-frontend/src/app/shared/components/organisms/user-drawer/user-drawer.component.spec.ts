import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserDrawerComponent } from './user-drawer.component';
import { USERS_REPOSITORY, UsersRepository } from '../../../../core/ports/users.repository';
import { ToastService } from '../../../services/toast.service';
import { of } from 'rxjs';
import { UserDetail, UserStatus } from '@rebecca/types';
import { DrawerService } from '../../../../core/services/drawer.service';

describe('UserDrawerComponent (White-box Coverage)', () => {
  let component: UserDrawerComponent;
  let fixture: ComponentFixture<UserDrawerComponent>;
  let mockUsersRepo: jasmine.SpyObj<UsersRepository>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  const mockUserDetail: UserDetail = {
    handle: 'alice_gal',
    name: 'Alice',
    status: UserStatus.ACTIVE,
    affinityScore: '92',
    interactions: 140,
    firstSeen: '2026-01-01',
    lastSeen: '2026-07-22',
    coreProfile: JSON.stringify({
      attributes: ['ギャル好き', 'アニメファン'],
      preferences: ['深夜アニメ'],
      concerns: [],
      important_memories: []
    })
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
    expect(component.user).toEqual(mockUserDetail);
    expect(component.isBlocked).toBeFalse();
    expect(component.parsedProfile['attributes']).toContain('ギャル好き');
  });

  it('should handle malformed coreProfile JSON gracefully', () => {
    const malformedUser = { ...mockUserDetail, coreProfile: 'INVALID_JSON{[' };
    mockUsersRepo.getById.and.returnValue(of(malformedUser));

    component.userId = 'user_123';
    component.ngOnChanges();

    expect(component.parsedProfile['attributes']).toEqual([]);
  });

  it('should add and remove tags from profile categories', () => {
    const input = document.createElement('input');
    input.value = 'ゲーム好き';
    const fakeEvent = { target: input } as unknown as Event;

    component.addTag('preferences', fakeEvent);
    expect(component.parsedProfile['preferences']).toContain('ゲーム好き');

    component.removeTag('preferences', 0);
    expect(component.parsedProfile['preferences']).not.toContain('深夜アニメ');
  });

  it('should toggle user status between Active and Blocked', () => {
    component.onBlockUser();
    expect(mockUsersRepo.bulkUpdateStatus).toHaveBeenCalledWith(['user_123'], UserStatus.BLOCKED);
    expect(mockToastService.show).toHaveBeenCalledWith(jasmine.stringMatching(/blocked/i), 'success');
  });

  it('should format JSON and save updated core profile', () => {
    component.onSaveProfile();
    const expectedJson = JSON.stringify(component.parsedProfile, null, 2);
    expect(mockUsersRepo.updateMemory).toHaveBeenCalledWith('user_123', expectedJson);
    expect(mockToastService.show).toHaveBeenCalledWith(jasmine.stringMatching(/saved core profile/i), 'success');
  });
});
