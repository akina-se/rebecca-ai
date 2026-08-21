import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginationComponent } from './pagination.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('PaginationComponent', () => {
  let component: PaginationComponent;
  let fixture: ComponentFixture<PaginationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginationComponent, HttpClientTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(PaginationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create pagination component', () => {
    expect(component).toBeTruthy();
  });

  it('should compute pageNumbers correctly for small total pages (<= 5)', () => {
    component.currentPage = 1;
    component.totalPages = 4;
    expect(component.pageNumbers).toEqual([1, 2, 3, 4]);
  });

  it('should compute smart windowing for large total pages', () => {
    component.currentPage = 2;
    component.totalPages = 10;
    expect(component.pageNumbers).toEqual([1, 2, 3, 4, 10]);

    component.currentPage = 9;
    expect(component.pageNumbers).toEqual([1, 7, 8, 9, 10]);

    component.currentPage = 5;
    expect(component.pageNumbers).toEqual([1, 4, 5, 6, 10]);
  });

  it('should emit pageChange on valid goToPage call', () => {
    spyOn(component.pageChange, 'emit');
    component.currentPage = 1;
    component.totalPages = 5;

    component.goToPage(3);
    expect(component.pageChange.emit).toHaveBeenCalledWith(3);
  });

  it('should not emit pageChange when target page is current page or invalid', () => {
    spyOn(component.pageChange, 'emit');
    component.currentPage = 2;
    component.totalPages = 5;

    component.goToPage(2);
    component.goToPage('...');
    expect(component.pageChange.emit).not.toHaveBeenCalled();
  });

  it('should navigate on previous and next buttons', () => {
    spyOn(component.pageChange, 'emit');
    component.currentPage = 3;
    component.totalPages = 5;

    component.onPrevious();
    expect(component.pageChange.emit).toHaveBeenCalledWith(2);

    component.onNext();
    expect(component.pageChange.emit).toHaveBeenCalledWith(4);
  });
});
