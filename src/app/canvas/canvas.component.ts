import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements OnInit {
  bgLeft: number;
  bgTop: number;
  _pageX: number;
  _pageY: number;
  _lastLeft: number;
  _lastTop: number;
  isCanvasDragging: boolean;

  constructor() {
    this.bgTop = 0;
    this.bgLeft = 0;
  }

  ngOnInit() {
  }

  mouseDown(e) {
    this._pageX = e.pageX;
    this._pageY = e.pageY;
    this._lastLeft = this.bgLeft;
    this._lastTop = this.bgTop;
    this.isCanvasDragging = true;
  }

  mouseMove(e) {
    if (!this.isCanvasDragging) {
      return;
    }

    this.bgLeft = this._lastLeft + e.pageX - this._pageX;
    this.bgTop = this._lastTop + e.pageY - this._pageY;
  }

  mouseUp() {
    this.isCanvasDragging = false;
  }
}
