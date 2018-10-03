import { Component, OnInit, Input } from '@angular/core';
import { Link } from '../network-devices';
import { Vector } from '../vector';

@Component({
  selector: 'app-link-panel',
  templateUrl: './link-panel.component.html',
  styleUrls: ['./link-panel.component.css']
})
export class LinkPanelComponent implements OnInit {

  @Input() model: Link;
  @Input() canvasOffset: Vector;

  constructor() { }

  ngOnInit() {
  }

}
