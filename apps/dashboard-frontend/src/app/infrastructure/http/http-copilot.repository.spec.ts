import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpCopilotRepository } from './http-copilot.repository';

describe('HttpCopilotRepository', () => {
  let repository: HttpCopilotRepository;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [HttpCopilotRepository]
    });
    repository = TestBed.inject(HttpCopilotRepository);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should post chat request to /api/v1/copilot/chat', () => {
    const mockRequest = {
      message: 'Analyze daily engagement trends',
      currentContext: 'Page: Dashboard',
      history: [],
      language: 'ja' as const
    };

    repository.chat(mockRequest).subscribe((res) => {
      expect(res.reply).toBe('Analysis completed');
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/copilot/chat') && r.method === 'POST');
    expect(req.request.body).toEqual(mockRequest);
    req.flush({ reply: 'Analysis completed', suggestionChips: [] });
  });
});
