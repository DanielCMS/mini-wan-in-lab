import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NetworkStructureComponent } from './network-structure.component';

describe('NetworkStructureComponent', () => {
  let component: NetworkStructureComponent;
  let fixture: ComponentFixture<NetworkStructureComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NetworkStructureComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NetworkStructureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
