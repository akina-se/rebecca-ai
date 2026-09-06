import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kpi-card.component.html',
  styleUrls: ['./kpi-card.component.css']
})
export class KpiCardComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) icon!: string;
  @Input() value: number | string | null = null;
  @Input() unit?: string;
  @Input() trend: number | null = null;
  @Input() trendLabel = '';
  @Input() history?: number[];

  get formattedValue(): string {
    if (this.value === null || this.value === undefined) {
      return '—';
    }
    if (typeof this.value === 'number') {
      const formatted = this.value.toLocaleString();
      return this.unit ? `${formatted}${this.unit}` : formatted;
    }
    return this.unit ? `${this.value}${this.unit}` : String(this.value);
  }

  get isPositiveTrend(): boolean {
    return (this.trend ?? 0) >= 0;
  }

  get trendIcon(): string {
    if (this.trend === null || this.trend === undefined) {
      return 'trending_flat';
    }
    if (this.trend > 0) {
      return 'trending_up';
    }
    if (this.trend < 0) {
      return 'trending_down';
    }
    return 'trending_flat';
  }

  getSparklinePoints(history: number[] = [], height = 20, width = 100): string {
    if (!history || history.length === 0) {
      return `0,${height} ${width},${height}`;
    }
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const step = width / (history.length - 1 || 1);
    const points = history.map((val, i) => {
      const x = i * step;
      const y = height - ((val - min) / range) * (height - 2) - 1;
      return `${x},${y}`;
    });
    return points.join(' ');
  }

  getSparklinePolygon(history: number[] = [], height = 20, width = 100): string {
    if (!history || history.length === 0) {
      return `0,${height} ${width},${height}`;
    }
    const polyline = this.getSparklinePoints(history, height, width);
    return `0,${height} ${polyline} ${width},${height}`;
  }
}
