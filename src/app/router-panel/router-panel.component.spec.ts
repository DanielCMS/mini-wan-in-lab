import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RouterPanelComponent } from './router-panel.component';

describe('RouterPanelComponent', () => {
  let component: RouterPanelComponent;
  let fixture: ComponentFixture<RouterPanelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RouterPanelComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RouterPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
