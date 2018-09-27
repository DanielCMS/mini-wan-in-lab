import { TestBed, inject } from '@angular/core/testing';

import { NetworkRegistryService } from './network-registry.service';

describe('NetworkRegistryService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NetworkRegistryService]
    });
  });

  it('should be created', inject([NetworkRegistryService], (service: NetworkRegistryService) => {
    expect(service).toBeTruthy();
  }));
});
