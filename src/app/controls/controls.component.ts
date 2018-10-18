import { Component, EventEmitter, OnInit, Input, Output } from '@angular/core';
import { CanvasStatus } from '../canvas-status';

@Component({
  selector: 'app-controls',
  templateUrl: './controls.component.html',
  styleUrls: ['./controls.component.scss']
})
export class ControlsComponent implements OnInit {
  @Input() canvasStatus: CanvasStatus;
  @Input() activeDeviceId: string;
  @Output() addRouterClicked = new EventEmitter<void>();
  @Output() addHostClicked = new EventEmitter<void>();
  @Output() addLinkClicked = new EventEmitter<void>();  
  @Output() deleteClicked = new EventEmitter<void>();

  CanvasStatus = CanvasStatus;

  constructor() { }

  ngOnInit() {
  }

  public isAdding(): boolean {
    return [CanvasStatus.AddingRouter, CanvasStatus.AddingHost,
      CanvasStatus.AddingLink].includes(this.canvasStatus);
  }

  public elementSelected(): boolean {
    return !!this.activeDeviceId;
  }

  public addRouter(): void {
    this.addRouterClicked.emit();
  }

  public addHost(): void {
    this.addHostClicked.emit();
  }

  public addLink(): void {
    this.addLinkClicked.emit();
  }  

  public delete(): void {
    this.deleteClicked.emit();
  }
}
