import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { MemoryPageComponent } from './memory-page.component';
import { MEMORY_REPOSITORY } from '../../../core/ports/memory.repository';
import { ToastService } from '../../../shared/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { SettingsService } from '../../../core/services/settings.service';

describe('MemoryPageComponent', () => {
  let component: MemoryPageComponent;
  let fixture: ComponentFixture<MemoryPageComponent>;
  let memoryRepoSpy: jasmine.SpyObj<any>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    memoryRepoSpy = jasmine.createSpyObj('MemoryRepository', ['getLayers', 'triggerDreaming']);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['show']);

    await TestBed.configureTestingModule({
      imports: [MemoryPageComponent, HttpClientTestingModule],
      providers: [
        { provide: MEMORY_REPOSITORY, useValue: memoryRepoSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        TranslationService,
        SettingsService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MemoryPageComponent);
    component = fixture.componentInstance;
  });

  it('should create memory page component and load layers', () => {
    memoryRepoSpy.getLayers.and.returnValue(of([
      { level: 0, name: 'Core Persona', updatedAt: null },
      { level: 1, name: 'Extended Tuning', updatedAt: '2026-08-15T00:00:00Z' },
      { level: 2, name: 'Timeline Summary', updatedAt: '2026-08-15T00:00:00Z' }
    ]));

    component.ngOnInit();

    expect(memoryRepoSpy.getLayers).toHaveBeenCalled();
    expect(component.layers().length).toBe(3);
    expect(component.isLoading()).toBeFalse();
  });

  it('should handle load layers error gracefully', () => {
    memoryRepoSpy.getLayers.and.returnValue(throwError(() => new Error('Error')));

    component.loadLayers();

    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to load memory layers', 'error');
    expect(component.isLoading()).toBeFalse();
  });

  it('should open drawer with correct level, title, and icons', () => {
    component.openDrawer(0);
    expect(component.drawerLevel()).toBe(0);
    expect(component.drawerIcon()).toBe('dns');

    component.openDrawer(1);
    expect(component.drawerLevel()).toBe(1);
    expect(component.drawerIcon()).toBe('tune');

    component.openDrawer(2);
    expect(component.drawerLevel()).toBe(2);
    expect(component.drawerIcon()).toBe('public');
  });

  it('should format date strings properly', () => {
    expect(component.formatDate(null)).toBe('System Deploy');
    expect(component.formatDate('invalid_date')).toBe('invalid_date');
    expect(component.formatDate('2026-08-15T12:00:00Z')).toContain('2026');
  });

  it('should trigger force dreaming on forceDreaming and handle error', async () => {
    memoryRepoSpy.getLayers.and.returnValue(of([]));
    memoryRepoSpy.triggerDreaming.and.returnValue(of({ status: 'TRIGGERED' }));

    await component.forceDreaming();

    expect(memoryRepoSpy.triggerDreaming).toHaveBeenCalled();
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/Force Dreaming completed/), 'success');
    expect(component.isDreaming).toBeFalse();

    // Error case
    memoryRepoSpy.triggerDreaming.and.returnValue(throwError(() => new Error('Dreaming error')));
    await component.forceDreaming();
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Force Dreaming failed.', 'error');
  });
});
