import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { HostPanelComponent } from './host-panel.component';

describe('HostPanelComponent', () => {
  let component: HostPanelComponent;
  let fixture: ComponentFixture<HostPanelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ HostPanelComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HostPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
