import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { MemoryDrawerComponent } from './memory-drawer.component';
import { MEMORY_REPOSITORY } from '../../../../core/ports/memory.repository';
import { ToastService } from '../../../services/toast.service';

describe('MemoryDrawerComponent', () => {
  let component: MemoryDrawerComponent;
  let fixture: ComponentFixture<MemoryDrawerComponent>;
  let memoryRepoSpy: jasmine.SpyObj<any>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    memoryRepoSpy = jasmine.createSpyObj('MemoryRepository', [
      'getCoreMemory',
      'getExtendedMemory',
      'getGlobalMemory',
      'updateExtendedMemory',
      'updateGlobalMemory'
    ]);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['show']);

    await TestBed.configureTestingModule({
      imports: [MemoryDrawerComponent, HttpClientTestingModule],
      providers: [
        { provide: MEMORY_REPOSITORY, useValue: memoryRepoSpy },
        { provide: ToastService, useValue: toastServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MemoryDrawerComponent);
    component = fixture.componentInstance;
  });

  it('should create memory drawer component', () => {
    expect(component).toBeTruthy();
  });

  it('should load Layer 0 Core Memory when level is 0', () => {
    memoryRepoSpy.getCoreMemory.and.returnValue(of({ content: 'Core Rebecca Prompt' }));

    component.level = 0;
    component.ngOnChanges();

    expect(memoryRepoSpy.getCoreMemory).toHaveBeenCalled();
    expect(component.corePrompt()).toBe('Core Rebecca Prompt');
    expect(component.isLoading()).toBeFalse();
  });

  it('should load Layer 1 Extended Memory when level is 1', () => {
    memoryRepoSpy.getExtendedMemory.and.returnValue(of({ content: 'Extended Persona Tuning' }));

    component.level = 1;
    component.ngOnChanges();

    expect(memoryRepoSpy.getExtendedMemory).toHaveBeenCalled();
    expect(component.extendedPrompt()).toBe('Extended Persona Tuning');
  });

  it('should load Layer 2 Global Memory when level is 2', () => {
    memoryRepoSpy.getGlobalMemory.and.returnValue(of({ content: 'Global Timeline Summary' }));

    component.level = 2;
    component.ngOnChanges();

    expect(memoryRepoSpy.getGlobalMemory).toHaveBeenCalled();
    expect(component.timelineSummary()).toBe('Global Timeline Summary');
  });

  it('should save Layer 1 tuning on onSavePrompt', () => {
    component.extendedPrompt.set('New Persona Tuning');
    memoryRepoSpy.updateExtendedMemory.and.returnValue(of({ success: true }));

    component.onSavePrompt();

    expect(memoryRepoSpy.updateExtendedMemory).toHaveBeenCalledWith('New Persona Tuning');
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/saved Extended/), 'success');
  });

  it('should save Layer 2 summary on onSaveSummary', () => {
    component.timelineSummary.set('New Global Timeline Summary');
    memoryRepoSpy.updateGlobalMemory.and.returnValue(of({ success: true }));

    component.onSaveSummary();

    expect(memoryRepoSpy.updateGlobalMemory).toHaveBeenCalledWith('New Global Timeline Summary');
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/saved Global/), 'success');
  });

  it('should handle errors when loading memory fails', () => {
    memoryRepoSpy.getCoreMemory.and.returnValue(throwError(() => new Error('Load failed')));

    component.level = 0;
    component.ngOnChanges();

    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to load Persona Core Prompt', 'error');
    expect(component.isLoading()).toBeFalse();

    memoryRepoSpy.getExtendedMemory.and.returnValue(throwError(() => new Error('Load failed')));
    component.level = 1;
    component.ngOnChanges();
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to load Extended Tuning Prompt', 'error');

    memoryRepoSpy.getGlobalMemory.and.returnValue(throwError(() => new Error('Load failed')));
    component.level = 2;
    component.ngOnChanges();
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to load Global Timeline Summary', 'error');
  });

  it('should handle empty data content across all levels', () => {
    memoryRepoSpy.getCoreMemory.and.returnValue(of({}));
    component.level = 0;
    component.ngOnChanges();
    expect(component.corePrompt()).toBe('');

    memoryRepoSpy.getExtendedMemory.and.returnValue(of({}));
    component.level = 1;
    component.ngOnChanges();
    expect(component.extendedPrompt()).toBe('');

    memoryRepoSpy.getGlobalMemory.and.returnValue(of({}));
    component.level = 2;
    component.ngOnChanges();
    expect(component.timelineSummary()).toBe('');
  });

  it('should handle save prompt and summary errors', () => {
    memoryRepoSpy.updateExtendedMemory.and.returnValue(throwError(() => new Error('Save err')));
    component.onSavePrompt();
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to save Extended Persona Tuning', 'error');

    memoryRepoSpy.updateGlobalMemory.and.returnValue(throwError(() => new Error('Save err')));
    component.onSaveSummary();
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to save Global Timeline Summary', 'error');
  });
});
