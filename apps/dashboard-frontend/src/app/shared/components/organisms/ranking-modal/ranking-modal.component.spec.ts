import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RankingModalComponent } from './ranking-modal.component';

describe('RankingModalComponent', () => {
  let component: RankingModalComponent;
  let fixture: ComponentFixture<RankingModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RankingModalComponent, HttpClientTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(RankingModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create ranking modal component', () => {
    expect(component).toBeTruthy();
  });

  it('should compute pagination and pagedEntries properly', () => {
    component.entries = Array.from({ length: 25 }, (_, i) => ({
      id: `item_${i}`,
      rank: i + 1,
      label: `Item ${i + 1}`,
      value: (100 - i) * 10
    }));

    expect(component.computedTotalPages).toBe(3);
    expect(component.pagedEntries.length).toBe(10);
    expect(component.pagedEntries[0].id).toBe('item_0');

    spyOn(component.pageChange, 'emit');
    component.goToPage(2);
    expect(component.currentPage).toBe(2);
    expect(component.pageChange.emit).toHaveBeenCalledWith(2);
    expect(component.pagedEntries[0].id).toBe('item_10');
  });

  it('should emit rowClick and close on onRowClick', () => {
    spyOn(component.rowClick, 'emit');
    spyOn(component.modalClose, 'emit');

    const entry = { id: 'item_5', rank: 6, label: 'Item 6', value: 50 };
    component.onRowClick(entry);

    expect(component.rowClick.emit).toHaveBeenCalledWith('item_5');
    expect(component.modalClose.emit).toHaveBeenCalled();
  });

  it('should compute total pages from totalPages input and totalItems input', () => {
    component.totalPages = 5;
    expect(component.computedTotalPages).toBe(5);

    component.totalPages = 1;
    component.totalItems = 45;
    component.pageSize = 10;
    expect(component.computedTotalPages).toBe(5);

    component.totalItems = 0;
    component.entries = [{ rank: 1, label: 'Single', value: 10 }];
    expect(component.computedTotalPages).toBe(1);
    expect(component.pagedEntries.length).toBe(1);
  });

  it('should ignore invalid page navigation in goToPage', () => {
    spyOn(component.pageChange, 'emit');
    component.totalPages = 3;
    component.goToPage(0);
    expect(component.pageChange.emit).not.toHaveBeenCalled();

    component.goToPage(10);
    expect(component.pageChange.emit).not.toHaveBeenCalled();
  });

  it('should handle text selection and missing id in onRowClick', () => {
    spyOn(component.rowClick, 'emit');
    spyOn(component.modalClose, 'emit');

    // Without id
    component.onRowClick({ rank: 1, label: 'No ID', value: 10 });
    expect(component.rowClick.emit).not.toHaveBeenCalled();

    // With text selection
    spyOn(window, 'getSelection').and.returnValue({
      toString: () => 'selected text'
    } as any);

    component.onRowClick({ id: 'item_1', rank: 1, label: 'With ID', value: 10 });
    expect(component.rowClick.emit).not.toHaveBeenCalled();
  });

  it('should not close when clicking modal content inside backdrop', () => {
    spyOn(component.modalClose, 'emit');

    const mockEvent = {
      target: { classList: { contains: (_cls: string) => false } }
    } as any;

    component.onBackdropClick(mockEvent);
    expect(component.modalClose.emit).not.toHaveBeenCalled();
  });
});
