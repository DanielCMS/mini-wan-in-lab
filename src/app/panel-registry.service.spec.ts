import { TestBed, inject } from '@angular/core/testing';

import { PanelRegistryService } from './panel-registry.service';

describe('PanelRegistryService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PanelRegistryService]
    });
  });

  it('should be created', inject([PanelRegistryService], (service: PanelRegistryService) => {
    expect(service).toBeTruthy();
  }));
});
