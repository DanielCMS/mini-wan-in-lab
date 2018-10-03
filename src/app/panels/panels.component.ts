import { Component, OnInit } from '@angular/core';
import { PanelRegistry } from '../panel-registry.service';
import { Link, Router, Host } from '../network-devices';
 
@Component({
  selector: 'app-panels',
  templateUrl: './panels.component.html',
  styleUrls: ['./panels.component.scss']
})
export class PanelsComponent implements OnInit {

  private Router = Router;
  private Link = Link;
  private Host = Host;

  constructor(private panelRegistry: PanelRegistry) { }

  ngOnInit() {
  }

}
