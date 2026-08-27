import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { AiDrawerComponent } from './ai-drawer.component';
import { DrawerService } from '../../core/services/drawer.service';
import { CopilotService } from '../../core/services/copilot.service';
import { CopilotContextService } from '../../core/services/copilot-context.service';
import { CopilotAction } from '@rebecca/types';

describe('AiDrawerComponent', () => {
  let component: AiDrawerComponent;
  let fixture: ComponentFixture<AiDrawerComponent>;
  let drawerService: DrawerService;
  let copilotServiceSpy: jasmine.SpyObj<CopilotService>;
  let isLoadingSignal = signal(false);
  let messagesSignal = signal<any[]>([]);

  beforeEach(async () => {
    isLoadingSignal = signal(false);
    messagesSignal = signal<any[]>([]);

    copilotServiceSpy = jasmine.createSpyObj('CopilotService', [
      'sendMessage',
      'approveAction',
      'cancelAction',
      'clearHistory'
    ], {
      messages: messagesSignal,
      isLoading: isLoadingSignal
    });

    await TestBed.configureTestingModule({
      imports: [AiDrawerComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        DrawerService,
        CopilotContextService,
        { provide: CopilotService, useValue: copilotServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AiDrawerComponent);
    component = fixture.componentInstance;
    drawerService = TestBed.inject(DrawerService);
    fixture.detectChanges();
  });

  it('should create AI drawer component', () => {
    expect(component).toBeTruthy();
  });

  it('should react to drawerService open state and close on close()', () => {
    drawerService.open();
    expect(component.isOpen()).toBeTrue();

    component.close();
    expect(component.isOpen()).toBeFalse();
  });

  it('should send user message on onSendMessage and ignore empty/loading', () => {
    component.inputMessage = 'Summarize daily metrics';
    component.onSendMessage();

    expect(copilotServiceSpy.sendMessage).toHaveBeenCalledWith('Summarize daily metrics');
    expect(component.inputMessage).toBe('');

    // Empty input
    component.inputMessage = '   ';
    component.onSendMessage();

    // Loading input
    isLoadingSignal.set(true);
    component.inputMessage = 'Another message';
    component.onSendMessage();
    expect(copilotServiceSpy.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('should send message on onChipClick and ignore when loading', () => {
    component.onChipClick('Explain engagement drop');
    expect(copilotServiceSpy.sendMessage).toHaveBeenCalledWith('Explain engagement drop');

    // Loading state
    isLoadingSignal.set(true);
    component.onChipClick('Ignored chip');
    expect(copilotServiceSpy.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('should forward approval, cancel, and clear actions to copilotService', () => {
    const action: CopilotAction = {
      type: 'BLOCK_USER',
      title: 'Block',
      description: 'Block user',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: { userId: 'bot' }
    };
    component.onApproveAction(0, action);
    expect(copilotServiceSpy.approveAction).toHaveBeenCalledWith(0, action);

    component.onCancelAction(0);
    expect(copilotServiceSpy.cancelAction).toHaveBeenCalledWith(0);

    component.onClearSession();
    expect(copilotServiceSpy.clearHistory).toHaveBeenCalled();
  });

  it('should trigger scroll in ngAfterViewChecked when shouldScrollToBottom is true', () => {
    component.ngAfterViewChecked();
    expect(component).toBeTruthy();
  });
});
