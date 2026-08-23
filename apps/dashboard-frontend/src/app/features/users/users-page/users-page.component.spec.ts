import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { UsersPageComponent } from './users-page.component';
import { USERS_REPOSITORY } from '../../../core/ports/users.repository';
import { ToastService } from '../../../shared/services/toast.service';
import { UserStatus } from '@rebecca/types';

describe('UsersPageComponent', () => {
  let component: UsersPageComponent;
  let fixture: ComponentFixture<UsersPageComponent>;
  let usersRepoSpy: jasmine.SpyObj<any>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    usersRepoSpy = jasmine.createSpyObj('UsersRepository', ['getAll', 'bulkUpdateStatus']);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['show']);

    await TestBed.configureTestingModule({
      imports: [UsersPageComponent, HttpClientTestingModule],
      providers: [
        { provide: USERS_REPOSITORY, useValue: usersRepoSpy },
        { provide: ToastService, useValue: toastServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UsersPageComponent);
    component = fixture.componentInstance;
  });

  it('should create users page component and load users on init', () => {
    usersRepoSpy.getAll.and.returnValue(of({
      data: [
        { id: 'u_alice', username: 'alice', interactions: 10, lastSeen: '2026-08-15', status: UserStatus.ACTIVE } as any
      ],
      meta: { totalItems: 1, totalPages: 1 }
    }));

    component.ngOnInit();

    expect(usersRepoSpy.getAll).toHaveBeenCalled();
    expect(component.users.length).toBe(1);
    expect(component.users[0].username).toBe('alice');
    expect(component.isLoading).toBeFalse();
  });

  it('should handle load users error gracefully', () => {
    usersRepoSpy.getAll.and.returnValue(throwError(() => new Error('Load failed')));

    component.loadUsers();

    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to load users', 'error');
    expect(component.isLoading).toBeFalse();
  });

  it('should handle sorting toggle on column click', () => {
    usersRepoSpy.getAll.and.returnValue(of({ data: [], meta: { totalItems: 0, totalPages: 1 } }));

    component.userSortBy = 'interactions';
    component.userSortOrder = 'desc';

    component.toggleUserSort('interactions');
    expect(component.userSortOrder).toBe('asc');

    component.toggleUserSort('username');
    expect(component.userSortBy).toBe('username');
    expect(component.userSortOrder).toBe('desc');
  });

  it('should toggle select all users and handle individual selection changes', () => {
    component.users = [
      { id: 'alice', username: 'alice', interactions: 10, lastSeen: '2026-08-15', status: UserStatus.ACTIVE } as any,
      { id: 'bob', username: 'bob', interactions: 5, lastSeen: '2026-08-15', status: UserStatus.ACTIVE } as any
    ];

    component.toggleSelectAll();
    expect(component.selectAll).toBeTrue();
    expect(component.selectedUsers.size).toBe(2);

    const mockUncheckEvent = { stopPropagation: jasmine.createSpy(), target: { checked: false } } as any;
    component.toggleSelection('alice', mockUncheckEvent);
    expect(component.selectedUsers.has('alice')).toBeFalse();
    expect(component.selectAll).toBeFalse();

    const mockCheckEvent = { stopPropagation: jasmine.createSpy(), target: { checked: true } } as any;
    component.toggleSelection('alice', mockCheckEvent);
    expect(component.selectedUsers.has('alice')).toBeTrue();
    expect(component.selectAll).toBeTrue();

    component.toggleSelectAll();
    expect(component.selectAll).toBeFalse();
    expect(component.selectedUsers.size).toBe(0);
  });

  it('should execute bulk block on selected users and handle error', async () => {
    usersRepoSpy.getAll.and.returnValue(of({ data: [], meta: { totalItems: 0, totalPages: 1 } }));
    usersRepoSpy.bulkUpdateStatus.and.returnValue(of({ success: true, count: 1 }));

    component.selectedUsers.add('spammer_bot');
    await component.executeBulkBlock();

    expect(usersRepoSpy.bulkUpdateStatus).toHaveBeenCalledWith(['spammer_bot'], UserStatus.BLOCKED);
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/blocked 1 users/), 'success');

    // Error case
    component.selectedUsers.add('spammer_bot');
    usersRepoSpy.bulkUpdateStatus.and.returnValue(throwError(() => new Error('Block failed')));
    await component.executeBulkBlock();
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to block users', 'error');
  });

  it('should execute bulk unblock on selected users and handle error', async () => {
    usersRepoSpy.getAll.and.returnValue(of({ data: [], meta: { totalItems: 0, totalPages: 1 } }));
    usersRepoSpy.bulkUpdateStatus.and.returnValue(of({ success: true, count: 1 }));

    component.selectedUsers.add('rehabilitated_user');
    await component.executeBulkUnblock();

    expect(usersRepoSpy.bulkUpdateStatus).toHaveBeenCalledWith(['rehabilitated_user'], UserStatus.ACTIVE);
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/unblocked 1 users/), 'success');

    // Error case
    component.selectedUsers.add('rehabilitated_user');
    usersRepoSpy.bulkUpdateStatus.and.returnValue(throwError(() => new Error('Unblock failed')));
    await component.executeBulkUnblock();
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to unblock users', 'error');
  });

  it('should handle search change and page change', () => {
    usersRepoSpy.getAll.and.returnValue(of({ data: [], meta: { totalItems: 0, totalPages: 1 } }));
    component.onSearchChange();
    component.onPageChange(3);
    expect(component.currentPage).toBe(3);
  });

  it('should open user drawer on openUserDrawer and ignore when text is selected', () => {
    component.openUserDrawer('alice');
    expect(component.selectedUserId).toBe('alice');
    expect(component.isDrawerOpen).toBeTrue();

    // When text is selected
    spyOn(window, 'getSelection').and.returnValue({ toString: () => 'copied text' } as any);
    component.isDrawerOpen = false;
    component.openUserDrawer('bob');
    expect(component.isDrawerOpen).toBeFalse();
  });

  it('should return early from bulk actions when no users selected', async () => {
    component.selectedUsers.clear();
    await component.executeBulkBlock();
    await component.executeBulkUnblock();
    expect(usersRepoSpy.bulkUpdateStatus).not.toHaveBeenCalled();
  });

  it('should sort by lastSeen', () => {
    usersRepoSpy.getAll.and.returnValue(of({ data: [], meta: { totalItems: 0, totalPages: 1 } }));
    component.toggleUserSort('lastSeen');
    expect(component.userSortBy).toBe('lastSeen');
    expect(component.userSortOrder).toBe('desc');
  });
});
