import { Component, OnInit, Input } from '@angular/core';
import { Router } from '../network-devices';

@Component({
  selector: 'app-router-panel',
  templateUrl: './router-panel.component.html',
  styleUrls: ['./router-panel.component.scss']
})
export class RouterPanelComponent implements OnInit {

  @Input() model: Router;

  constructor() { }

  ngOnInit() {
  }

}
