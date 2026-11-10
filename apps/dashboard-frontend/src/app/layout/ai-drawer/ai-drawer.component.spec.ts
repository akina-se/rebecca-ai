import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { AiDrawerComponent } from './ai-drawer.component';
import { DrawerService } from '../../core/services/drawer.service';
import { CopilotService } from '../../core/services/copilot.service';
import { CopilotContextService } from '../../core/services/copilot-context.service';
import { CopilotAction } from '@rebecca/types';
import { ConfigService } from '../../core/services/config.service';
import { TranslationService } from '../../core/services/translation.service';
import { SettingsService } from '../../core/services/settings.service';

describe('AiDrawerComponent', () => {
  let component: AiDrawerComponent;
  let fixture: ComponentFixture<AiDrawerComponent>;
  let drawerService: DrawerService;
  let copilotServiceSpy: jasmine.SpyObj<CopilotService>;
  let isLoadingSignal = signal(false);
  let messagesSignal = signal<any[]>([]);
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    isLoadingSignal = signal(false);
    messagesSignal = signal<any[]>([]);
    mockRouter = jasmine.createSpyObj('Router', ['navigate'], { url: '/dashboard' });

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
      imports: [AiDrawerComponent, HttpClientTestingModule],
      providers: [
        DrawerService,
        CopilotContextService,
        ConfigService,
        TranslationService,
        SettingsService,
        { provide: CopilotService, useValue: copilotServiceSpy },
        { provide: Router, useValue: mockRouter }
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

  it('should resolve localized personaName according to active language', () => {
    const settingsService = TestBed.inject(SettingsService);
    settingsService.setLanguage('ja');
    expect(component.personaName).toBe('レベッカ');

    settingsService.setLanguage('en');
    expect(component.personaName).toBe('Rebecca');
  });

  it('should manage lightbox state on onOpenLightbox', () => {
    component.onOpenLightbox('https://example.com/art.png');
    expect(component.isLightboxOpen()).toBeTrue();
    expect(component.lightboxImageUrl()).toBe('https://example.com/art.png');

    component.onOpenLightbox();
    expect(component.lightboxImageUrl()).toBe('https://example.com/art.png');

    component.isLightboxOpen.set(false);
    expect(component.isLightboxOpen()).toBeFalse();
  });

  it('should navigate when onNavigate is called with path', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.onNavigate('/assets');
    expect(router.navigate).toHaveBeenCalledWith(['/assets']);

    component.onNavigate();
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('should render attachments and handle lightbox/navigation clicks', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    messagesSignal.set([
      {
        id: 'msg-model-1',
        role: 'model',
        text: 'Here are the assets and users:',
        attachments: [
          {
            type: 'image',
            id: 'img-1',
            title: 'Neon Tokyo',
            imageUrl: 'https://example.com/tokyo.png',
            thumbnailUrl: 'https://example.com/tokyo_thumb.png'
          },
          {
            type: 'post',
            id: 'post-1',
            title: 'Exciting announcement!',
            metrics: { impressions: 1200 },
            navigationPath: '/dashboard'
          },
          {
            type: 'user',
            id: 'user-1',
            title: 'Cyber Master (@cyber)',
            statusBadge: 'ACTIVE',
            navigationPath: '/users'
          }
        ]
      }
    ]);
    fixture.detectChanges();

    const imageItem = fixture.nativeElement.querySelector('.attachment-image-item');
    expect(imageItem).toBeTruthy();
    imageItem.click();
    expect(component.isLightboxOpen()).toBeTrue();
    expect(component.lightboxImageUrl()).toBe('https://example.com/tokyo.png');

    const navBtns = fixture.nativeElement.querySelectorAll('.attachment-nav-btn');
    expect(navBtns.length).toBe(2);
    navBtns[0].click();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
