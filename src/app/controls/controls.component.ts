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

  private isAdding(): boolean {
    return [CanvasStatus.AddingRouter, CanvasStatus.AddingHost,
      CanvasStatus.AddingLink].includes(this.canvasStatus);
  }

  private elementSelected(): boolean {
    return !!this.activeDeviceId;
  }

  private addRouter(): void {
    this.addRouterClicked.emit();
  }

  private addHost(): void {
    this.addHostClicked.emit();
  }

  private addLink(): void {
    this.addLinkClicked.emit();
  }  

  private delete(): void {
    this.deleteClicked.emit();
  }
}
