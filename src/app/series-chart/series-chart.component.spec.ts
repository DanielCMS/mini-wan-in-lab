import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SeriesChartComponent } from './series-chart.component';

describe('SeriesChartComponent', () => {
  let component: SeriesChartComponent;
  let fixture: ComponentFixture<SeriesChartComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SeriesChartComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SeriesChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
