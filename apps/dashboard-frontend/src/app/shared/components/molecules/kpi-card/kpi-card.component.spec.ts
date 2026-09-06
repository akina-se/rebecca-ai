import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KpiCardComponent } from './kpi-card.component';

describe('KpiCardComponent', () => {
  let component: KpiCardComponent;
  let fixture: ComponentFixture<KpiCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KpiCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(KpiCardComponent);
    component = fixture.componentInstance;
  });

  it('should create KPI card component', () => {
    expect(component).toBeTruthy();
  });

  it('should format numeric values with commas and optional unit', () => {
    component.value = 1250000;
    component.unit = undefined;
    expect(component.formattedValue).toBe((1250000).toLocaleString());

    component.unit = '%';
    component.value = 14.5;
    expect(component.formattedValue).toBe('14.5%');
  });

  it('should format null or undefined values as em-dash', () => {
    component.value = null;
    expect(component.formattedValue).toBe('—');
    component.value = undefined;
    expect(component.formattedValue).toBe('—');
  });

  it('should identify positive and negative trends correctly', () => {
    component.trend = 12.5;
    expect(component.isPositiveTrend).toBeTrue();
    expect(component.trendIcon).toBe('trending_up');

    component.trend = -5.2;
    expect(component.isPositiveTrend).toBeFalse();
    expect(component.trendIcon).toBe('trending_down');

    component.trend = 0;
    expect(component.isPositiveTrend).toBeTrue();
    expect(component.trendIcon).toBe('trending_flat');

    component.trend = null;
    expect(component.isPositiveTrend).toBeTrue();
    expect(component.trendIcon).toBe('trending_flat');
  });

  it('should calculate sparkline points and polygon strings', () => {
    const points = component.getSparklinePoints([10, 20, 15, 30], 20, 100);
    expect(points).toContain('0,');
    expect(points).toContain('100,');

    const polygon = component.getSparklinePolygon([10, 20, 15, 30], 20, 100);
    expect(polygon).toContain('0,20');
    expect(polygon).toContain('100,20');

    expect(component.getSparklinePoints([])).toBe('0,20 100,20');
    expect(component.getSparklinePolygon([])).toBe('0,20 100,20');
  });

  it('should render DOM elements accurately', () => {
    component.title = 'API Calls';
    component.icon = 'api';
    component.value = 450;
    component.trend = 22.6;
    component.trendLabel = 'vs previous';
    component.history = [100, 200, 300, 450];
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.card-title')?.textContent).toContain('API Calls');
    expect(compiled.querySelector('.card-value')?.textContent).toContain('450');
    expect(compiled.querySelector('.card-trend')?.textContent).toContain('+22.6% vs previous');
    expect(compiled.querySelector('.sparkline polyline')?.getAttribute('stroke')).toBe('var(--success)');
  });
});
