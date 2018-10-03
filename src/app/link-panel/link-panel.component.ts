import { Component, OnInit, Input } from '@angular/core';
import { Link } from '../network-devices';

@Component({
  selector: 'app-link-panel',
  templateUrl: './link-panel.component.html',
  styleUrls: ['./link-panel.component.css']
})
export class LinkPanelComponent implements OnInit {

  @Input() model: Link;

  constructor() { }

  ngOnInit() {
  }

}
