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
    spyOn(component.close, 'emit');

    const entry = { id: 'item_5', rank: 6, label: 'Item 6', value: 50 };
    component.onRowClick(entry);

    expect(component.rowClick.emit).toHaveBeenCalledWith('item_5');
    expect(component.close.emit).toHaveBeenCalled();
  });

  it('should close when clicking modal-backdrop', () => {
    spyOn(component.close, 'emit');

    const mockEvent = {
      target: { classList: { contains: (cls: string) => cls === 'modal-backdrop' } }
    } as any;

    component.onBackdropClick(mockEvent);
    expect(component.close.emit).toHaveBeenCalled();
  });
});
