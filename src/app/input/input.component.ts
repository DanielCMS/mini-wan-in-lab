import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-input',
  templateUrl: './input.component.html',
  styleUrls: ['./input.component.scss']
})
export class InputComponent implements OnInit {

  @Input() value: string;
  @Input() processor: (input: string, fallback: string) => string;
  @Output() changed = new EventEmitter<string>();

  constructor() { }

  ngOnInit() {
  }

  private process(value: string): string {
    let processed = this.processor(value, this.value);

    if (processed !== this.value) {
      this.changed.emit(processed);
    }

    return processed;
  }
}
