import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Host } from '../network-devices';
import { Vector } from '../vector';
import { FeedbackService } from '../feedback.service';

const X_OFFSET = 100;

@Component({
  selector: 'app-host-panel',
  templateUrl: './host-panel.component.html',
  styleUrls: ['./host-panel.component.scss']
})
export class HostPanelComponent implements OnInit {

  @Input() model: Host;
  @Input() canvasOffset: Vector;
  @Output() close = new EventEmitter<void>();

  private anchor: Vector;

  constructor(private feedback: FeedbackService) { }

  ngOnInit() {
    this.anchor = {
      x: Math.min(this.model.position.x + this.canvasOffset.x + X_OFFSET, window.innerWidth - 230),
      y: Math.min(this.model.position.y + this.canvasOffset.y, window.innerHeight - 230)
    };
  }

  private closePanel(): void {
    this.close.emit();
  }

  private addNewFlow(dest: string, data: number, startTime: number): void {
    this.model.addNewFlow(dest, data, startTime);
    if (this.model.hasInvalidFormat) {
      this.feedback.sendError("Invalid format: Destination should be a valid IPv4 address. Data should be a positive integer indicating the data amount to send. Status should be a non-negative integer indicating the starting time from now (in seconds).");
      this.model.hasInvalidFormat = false;
    }
  }

}
