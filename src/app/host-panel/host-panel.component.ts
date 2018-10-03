import { Component, OnInit, Input } from '@angular/core';
import { Host } from '../network-devices';

@Component({
  selector: 'app-host-panel',
  templateUrl: './host-panel.component.html',
  styleUrls: ['./host-panel.component.css']
})
export class HostPanelComponent implements OnInit {

  @Input() model: Host;

  constructor() { }

  ngOnInit() {
  }

}
